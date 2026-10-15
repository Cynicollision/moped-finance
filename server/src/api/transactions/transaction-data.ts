import {
    AnyColumn,
    eq,
    and,
    desc,
    asc,
    ilike,
    inArray,
    isNull,
    gt,
    gte,
    lt,
    lte,
    min,
    ne,
    sql,
    SQL
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortDirection } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { Transaction, TransactionSplitPart } from '@shared/finance/types';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { CategoryType, TransactionDirection, TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { Uncategorized } from '@shared/finance/util';
import { FinanceEntityFactory, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './../accounts/account-schema';
import { applyAdjustment, DbTransaction, undoAdjustment } from './../accounts/balance-history-data';
import { categoryGroupSchema } from './../categories/category-groups/category-group-schema';
import { categorySchema } from './../categories/category-schema';
import { transactionSchema } from './transaction-schema';

/** A transaction as written to CSV: the date as YYYY-MM-DD and the amount exactly as stored. */
export interface TransactionExport {
    date: string;
    accountName: string;
    merchant: string;
    categoryName: string;
    amount: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
}

/** A category's money in and money out over some dates, both as positive amounts. */
export interface CategoryFlow {
    /** Empty for uncategorized transactions. */
    categoryId: string;
    /** The category's group type; undefined for uncategorized transactions. */
    categoryType?: CategoryType;
    moneyIn: number;
    moneyOut: number;
}

export interface IFinanceTransactionData {
    search(options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]>;
    retrieveForExport(accountId?: string): Promise<TransactionExport[]>;
    retrieveMerchants(): Promise<string[]>;
    /** What came in and went out per category over the dates, counting what Spending counts (CASH-1.2). */
    retrieveCategoryFlows(startDate: CalendarDate, endDate: CalendarDate): Promise<CategoryFlow[]>;
    /** The date of the oldest transaction Spending counts, if there are any. */
    retrieveFirstDate(): Promise<CalendarDate | undefined>;
    retrieveSingle(id: string): Promise<Transaction | null>;
    /** The parts of a split, in order (TXN-4). */
    retrieveSplit(splitId: string): Promise<Transaction[]>;
    insert(transaction: Transaction): Promise<Transaction>;
    /**
     * Inserts all of the transactions or, if any insert fails, none of them, applying the balance changes of those
     * that adjust the balance in the same database transaction (ACCT-5.6, TXN-3.11).
     */
    insertBulk(transactions: Transaction[]): Promise<void>;
    /**
     * Saves the transaction. When it's split, the date, account, original statement, hidden flag and Adjust balance go
     * to every part (TXN-4.7).
     */
    update(transaction: Transaction): Promise<Transaction | null>;
    /**
     * Makes the parts of the transaction's split, in order: those with an ID it already has are changed, the others
     * added with its date, account, original statement, hidden flag and Adjust balance, and parts left out are deleted
     * (TXN-4.1, TXN-4.5). A transaction that isn't split is its own only part. Null when it doesn't exist.
     */
    split(id: string, parts: TransactionSplitPart[]): Promise<Transaction[] | null>;
    /**
     * Turns a split back into one transaction: its first part, with the total, and the others deleted (TXN-4.5). Null
     * when it doesn't exist.
     */
    unsplit(id: string): Promise<Transaction | null>;
    /** Deletes the transaction, with every part of its split (TXN-4.7). */
    delete(id: string): Promise<boolean>;
}

function mapRowToTransaction(row: typeof transactionSchema.$inferSelect): Transaction {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        accountId: row.accountId,
        categoryId: row.categoryId ?? '',
        date: row.date,
        amount: Number(row.amount),
        merchant: row.merchant,
        originalStatement: row.originalStatement ?? '',
        notes: row.notes ?? '',
        isHidden: row.isHidden,
        adjustsBalance: row.adjustsBalance,
        splitId: row.splitId ?? ''
    };
}

// Spending leaves out hidden transactions and those in hidden accounts (CASH-1.2). Needs the account joined.
const countedBySpending = and(eq(transactionSchema.isHidden, false), eq(accountSchema.isHidden, false));

// Sorting by name ignores case. Ties (same day, same merchant, ...) fall back to newest first, then id, so paging is stable.
function getSearchOrder(sortKey: TransactionsSortKey, direction: SortDirection): SQL[] {
    const columns: Record<TransactionsSortKey, SQL | AnyColumn> = {
        [TransactionsSortKey.Date]: transactionSchema.date,
        [TransactionsSortKey.Amount]: transactionSchema.amount,
        [TransactionsSortKey.Merchant]: transactionSchema.merchant,
        [TransactionsSortKey.Account]: sql`lower(${accountSchema.name})`,
        [TransactionsSortKey.Category]: sql`lower(${categorySchema.name})`
    };

    const primary = direction === SortDirection.Asc ? asc(columns[sortKey]) : desc(columns[sortKey]);
    const tiebreakers = sortKey === TransactionsSortKey.Date ? [] : [desc(transactionSchema.date)];
    return [primary, ...tiebreakers, asc(transactionSchema.id)];
}

// ILIKE treats % and _ as wildcards; escape them (and the escape character) so they match literally.
function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, c => '\\' + c);
}

const bulkInsertChunkSize = 1000;

function mapTransactionToRow(transaction: Transaction): typeof transactionSchema.$inferInsert {
    return {
        id: transaction.id,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId || null,
        date: transaction.date,
        amount: transaction.amount.toString(),
        merchant: transaction.merchant,
        originalStatement: transaction.originalStatement || null,
        notes: transaction.notes || null,
        isHidden: transaction.isHidden,
        adjustsBalance: transaction.adjustsBalance,
        splitId: transaction.splitId || null
    };
}

type BalanceAdjustment = Pick<Transaction, 'accountId' | 'date' | 'amount'>;
type AdjustableFields = Pick<Transaction, 'accountId' | 'date' | 'amount' | 'adjustsBalance' | 'isHidden'>;

/** The balance change a transaction makes: none unless it adjusts the balance and isn't hidden (ACCT-5.2, TXN-2.10). */
function balanceAdjustment(transaction: AdjustableFields | null): BalanceAdjustment | null {
    if (!transaction?.adjustsBalance || transaction.isHidden) {
        return null;
    }
    return { accountId: transaction.accountId, date: transaction.date, amount: transaction.amount };
}

/**
 * What saving a transaction does to balances (ACCT-5.3): undo the change it made as it was (`before`, null for a new
 * transaction) and apply the one it makes as it will be (`after`, null once deleted). Neither when they're the same
 * change, so editing only its merchant, category or notes leaves the balances alone.
 */
export function adjustmentChange(
    before: AdjustableFields | null,
    after: AdjustableFields | null
): { undo: BalanceAdjustment | null; apply: BalanceAdjustment | null } {
    const undo = balanceAdjustment(before);
    const apply = balanceAdjustment(after);
    const unchanged =
        undo && apply && undo.accountId === apply.accountId && undo.date === apply.date && undo.amount === apply.amount;
    return unchanged ? { undo: null, apply: null } : { undo, apply };
}

async function moveAdjustment(tx: DbTransaction, before: Transaction | null, after: Transaction | null): Promise<void> {
    const { undo, apply } = adjustmentChange(before, after);
    if (undo) {
        await undoAdjustment(tx, undo.accountId, undo.date, undo.amount);
    }
    if (apply) {
        await applyAdjustment(tx, apply.accountId, apply.date, apply.amount);
    }
}

export class FinanceTransactionData implements IFinanceTransactionData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveForExport(accountId?: string): Promise<TransactionExport[]> {
        const conditions: SQL[] = [];

        if (accountId) {
            conditions.push(eq(accountSchema.id, accountId));
        }

        const rows = await this.db
            .select({
                date: transactionSchema.date,
                accountName: accountSchema.name,
                merchant: transactionSchema.merchant,
                categoryName: categorySchema.name,
                amount: transactionSchema.amount,
                originalStatement: transactionSchema.originalStatement,
                notes: transactionSchema.notes,
                isHidden: transactionSchema.isHidden
            })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .leftJoin(categorySchema, eq(categorySchema.id, transactionSchema.categoryId))
            .where(and(...conditions))
            .orderBy(asc(transactionSchema.date), asc(transactionSchema.id));

        return rows.map(row => ({
            date: row.date,
            accountName: row.accountName,
            merchant: row.merchant,
            categoryName: row.categoryName ?? '',
            amount: row.amount,
            originalStatement: row.originalStatement ?? '',
            notes: row.notes ?? '',
            isHidden: row.isHidden
        }));
    }

    public async search(options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
        const conditions: SQL[] = [];

        if (accountId) {
            conditions.push(eq(accountSchema.id, accountId));
        }

        // The amount filters compare its size, and the direction its sign (TXN-1.14).
        const amountSize = sql`abs(${transactionSchema.amount})`;
        if (options.minAmount !== undefined) {
            conditions.push(gte(amountSize, String(options.minAmount)));
        }

        if (options.maxAmount !== undefined) {
            conditions.push(lte(amountSize, String(options.maxAmount)));
        }

        if (options.direction === TransactionDirection.Out) {
            conditions.push(lt(transactionSchema.amount, '0'));
        } else if (options.direction === TransactionDirection.In) {
            conditions.push(gt(transactionSchema.amount, '0'));
        }

        if (options.startDate) {
            conditions.push(gte(transactionSchema.date, options.startDate));
        }

        if (options.endDate) {
            conditions.push(lte(transactionSchema.date, options.endDate));
        }

        if (!options.includeHidden) {
            conditions.push(eq(transactionSchema.isHidden, false));
        }

        // A hidden account's transactions show only when the search is for that account (TXN-1.12).
        const forAccount = accountId || options.filters?.some(f => f.key === TransactionsFilterKey.AccountId);
        if (!forAccount) {
            conditions.push(eq(accountSchema.isHidden, false));
        }

        if (options.filters) {
            for (const filter of options.filters) {
                if (filter.key === TransactionsFilterKey.Merchant) {
                    conditions.push(ilike(transactionSchema.merchant, `%${escapeLikePattern(filter.value)}%`));
                } else if (filter.key === TransactionsFilterKey.Category) {
                    conditions.push(
                        filter.value === Uncategorized.filterValue
                            ? isNull(transactionSchema.categoryId)
                            : eq(transactionSchema.categoryId, filter.value)
                    );
                } else if (filter.key === TransactionsFilterKey.AccountId) {
                    conditions.push(eq(transactionSchema.accountId, filter.value));
                } else if (filter.key === TransactionsFilterKey.Group) {
                    conditions.push(eq(categorySchema.groupId, filter.value));
                }
            }
        }

        // Left join: a transaction whose category was deleted is uncategorized, not gone.
        const query = this.db
            .select({
                transaction: transactionSchema
            })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .leftJoin(categorySchema, eq(categorySchema.id, transactionSchema.categoryId))
            .where(and(...conditions))
            .orderBy(
                ...getSearchOrder(
                    options.sortKey ?? TransactionsSortKey.Date,
                    options.sortDirection ?? SortDirection.Desc
                )
            )
            .$dynamic();

        if (options.limit !== undefined) {
            query.limit(options.limit);
        }

        if (options.offset !== undefined) {
            query.offset(options.offset);
        }

        const rows = await query;
        return rows.map(row => mapRowToTransaction(row.transaction));
    }

    public async retrieveMerchants(): Promise<string[]> {
        const rows = await this.db
            .select({ merchant: transactionSchema.merchant })
            .from(transactionSchema)
            .groupBy(transactionSchema.merchant)
            .orderBy(transactionSchema.merchant);

        return rows.map(row => row.merchant);
    }

    public async retrieveSingle(id: string): Promise<Transaction | null> {
        const rows = await this.db.select().from(transactionSchema).where(eq(transactionSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToTransaction(rows[0]);
    }

    public async retrieveSplit(splitId: string): Promise<Transaction[]> {
        const rows = await this.db
            .select()
            .from(transactionSchema)
            .where(eq(transactionSchema.splitId, splitId))
            .orderBy(asc(transactionSchema.splitPosition), asc(transactionSchema.id));
        return rows.map(mapRowToTransaction);
    }

    public async retrieveCategoryFlows(startDate: CalendarDate, endDate: CalendarDate): Promise<CategoryFlow[]> {
        const amount = transactionSchema.amount;
        const rows = await this.db
            .select({
                categoryId: transactionSchema.categoryId,
                categoryType: categoryGroupSchema.type,
                moneyIn: sql`coalesce(sum(${amount}) filter (where ${amount} > 0), 0)`.mapWith(Number),
                moneyOut: sql`coalesce(-sum(${amount}) filter (where ${amount} < 0), 0)`.mapWith(Number)
            })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .leftJoin(categorySchema, eq(categorySchema.id, transactionSchema.categoryId))
            .leftJoin(categoryGroupSchema, eq(categoryGroupSchema.id, categorySchema.groupId))
            .where(and(gte(transactionSchema.date, startDate), lte(transactionSchema.date, endDate), countedBySpending))
            .groupBy(transactionSchema.categoryId, categoryGroupSchema.type);

        return rows.map(row => ({
            categoryId: row.categoryId ?? '',
            categoryType: (row.categoryType as CategoryType | null) ?? undefined,
            moneyIn: row.moneyIn,
            moneyOut: row.moneyOut
        }));
    }

    public async retrieveFirstDate(): Promise<CalendarDate | undefined> {
        const rows = await this.db
            .select({ date: min(transactionSchema.date) })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(countedBySpending);
        return rows[0]?.date ?? undefined;
    }

    public async insert(transaction: Transaction): Promise<Transaction> {
        // The transaction and its balance change are saved together or not at all (ACCT-5.6).
        return this.db.transaction(async tx => {
            const rows = await tx.insert(transactionSchema).values(mapTransactionToRow(transaction)).returning();
            const inserted = mapRowToTransaction(rows[0]);
            await moveAdjustment(tx, null, inserted);
            return inserted;
        });
    }

    public async insertBulk(transactions: Transaction[]): Promise<void> {
        // One transaction, so a failure in any chunk rolls back the earlier ones. Chunks keep each
        // statement under Postgres's 65,535 bind-parameter limit (11 columns per row).
        await this.db.transaction(async tx => {
            for (let i = 0; i < transactions.length; i += bulkInsertChunkSize) {
                const chunk = transactions.slice(i, i + bulkInsertChunkSize);
                await tx.insert(transactionSchema).values(chunk.map(mapTransactionToRow));
            }

            // One change per account and date, the day's total in cents: the same balances as one per transaction.
            const totals = new Map<string, BalanceAdjustment & { cents: number }>();
            for (const adjustment of transactions.map(balanceAdjustment)) {
                if (adjustment) {
                    const key = `${adjustment.accountId} ${adjustment.date}`;
                    const total = totals.get(key) ?? { ...adjustment, cents: 0 };
                    total.cents += Math.round(adjustment.amount * 100);
                    totals.set(key, total);
                }
            }
            for (const { accountId, date, cents } of totals.values()) {
                await applyAdjustment(tx, accountId, date, cents / 100);
            }
        });
    }

    public async update(transaction: Transaction): Promise<Transaction | null> {
        return this.db.transaction(async tx => {
            const [current] = await tx
                .select()
                .from(transactionSchema)
                .where(eq(transactionSchema.id, transaction.id!))
                .for('update');
            if (!current) {
                return null;
            }

            const rows = await tx
                .update(transactionSchema)
                .set({
                    accountId: transaction.accountId,
                    merchant: transaction.merchant,
                    categoryId: transaction.categoryId || null,
                    amount: transaction.amount.toString(),
                    date: transaction.date,
                    originalStatement: transaction.originalStatement || null,
                    notes: transaction.notes || null,
                    isHidden: transaction.isHidden,
                    adjustsBalance: transaction.adjustsBalance,
                    updatedAt: DateTimeUtil.now()
                })
                .where(eq(transactionSchema.id, transaction.id!))
                .returning();

            const updated = mapRowToTransaction(rows[0]);
            await moveAdjustment(tx, mapRowToTransaction(current), updated);

            // The rest of the split keeps the same date, account, statement, hidden flag and Adjust balance (TXN-4.7).
            if (current.splitId) {
                const others = await tx
                    .select()
                    .from(transactionSchema)
                    .where(and(eq(transactionSchema.splitId, current.splitId), ne(transactionSchema.id, current.id)))
                    .for('update');
                for (const other of others) {
                    const [changed] = await tx
                        .update(transactionSchema)
                        .set({
                            accountId: updated.accountId,
                            date: updated.date,
                            originalStatement: updated.originalStatement || null,
                            isHidden: updated.isHidden,
                            adjustsBalance: updated.adjustsBalance,
                            updatedAt: DateTimeUtil.now()
                        })
                        .where(eq(transactionSchema.id, other.id))
                        .returning();
                    await moveAdjustment(tx, mapRowToTransaction(other), mapRowToTransaction(changed));
                }
            }
            return updated;
        });
    }

    public async split(id: string, parts: TransactionSplitPart[]): Promise<Transaction[] | null> {
        // The parts add up to what they replace, on the same date and account, so the balances don't change (TXN-4.7).
        return this.db.transaction(async tx => {
            const [transaction] = await tx.select().from(transactionSchema).where(eq(transactionSchema.id, id));
            if (!transaction) {
                return null;
            }
            const current = transaction.splitId
                ? await tx
                      .select()
                      .from(transactionSchema)
                      .where(eq(transactionSchema.splitId, transaction.splitId))
                      .for('update')
                : [transaction];
            const splitId = transaction.splitId ?? FinanceEntityFactory.createSplitId();
            const kept = new Set(parts.map(part => part.id));

            const removed = current.filter(row => !kept.has(row.id)).map(row => row.id);
            if (removed.length > 0) {
                await tx.delete(transactionSchema).where(inArray(transactionSchema.id, removed));
            }

            for (const [position, part] of parts.entries()) {
                const fields = {
                    amount: part.amount.toString(),
                    categoryId: part.categoryId || null,
                    merchant: part.merchant,
                    notes: part.notes || null,
                    splitId,
                    splitPosition: position
                };
                if (part.id) {
                    await tx
                        .update(transactionSchema)
                        .set({ ...fields, updatedAt: DateTimeUtil.now() })
                        .where(eq(transactionSchema.id, part.id));
                } else {
                    const added = FinanceEntityFactory.createTransaction({
                        ...mapRowToTransaction(transaction),
                        id: undefined,
                        ...part
                    });
                    await tx.insert(transactionSchema).values({ ...mapTransactionToRow(added), ...fields });
                }
            }

            const rows = await tx
                .select()
                .from(transactionSchema)
                .where(eq(transactionSchema.splitId, splitId))
                .orderBy(asc(transactionSchema.splitPosition));
            return rows.map(mapRowToTransaction);
        });
    }

    public async unsplit(id: string): Promise<Transaction | null> {
        // The first part takes the total, on the same date and account, so the balances don't change.
        return this.db.transaction(async tx => {
            const [transaction] = await tx.select().from(transactionSchema).where(eq(transactionSchema.id, id));
            if (!transaction?.splitId) {
                return transaction ? mapRowToTransaction(transaction) : null;
            }

            const parts = await tx
                .select()
                .from(transactionSchema)
                .where(eq(transactionSchema.splitId, transaction.splitId))
                .orderBy(asc(transactionSchema.splitPosition), asc(transactionSchema.id))
                .for('update');
            const [first, ...others] = parts;
            const cents = parts.reduce((sum, part) => sum + Math.round(Number(part.amount) * 100), 0);

            if (others.length > 0) {
                await tx.delete(transactionSchema).where(
                    inArray(
                        transactionSchema.id,
                        others.map(part => part.id)
                    )
                );
            }
            const [merged] = await tx
                .update(transactionSchema)
                .set({
                    amount: (cents / 100).toString(),
                    splitId: null,
                    splitPosition: null,
                    updatedAt: DateTimeUtil.now()
                })
                .where(eq(transactionSchema.id, first.id))
                .returning();
            return mapRowToTransaction(merged);
        });
    }

    public async delete(id: string): Promise<boolean> {
        return this.db.transaction(async tx => {
            const [transaction] = await tx.select().from(transactionSchema).where(eq(transactionSchema.id, id));
            if (!transaction) {
                return false;
            }

            // Deleting a part deletes the whole split (TXN-4.7).
            const rows = await tx
                .delete(transactionSchema)
                .where(
                    transaction.splitId
                        ? eq(transactionSchema.splitId, transaction.splitId)
                        : eq(transactionSchema.id, transaction.id)
                )
                .returning();
            for (const row of rows) {
                await moveAdjustment(tx, mapRowToTransaction(row), null);
            }
            return rows.length > 0;
        });
    }
}
