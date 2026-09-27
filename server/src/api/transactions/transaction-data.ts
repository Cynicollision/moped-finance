import { AnyColumn, eq, and, desc, asc, ilike, sum, gte, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortDirection } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { Transaction } from '@shared/finance/types';
import { CashflowStream, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';
import { transactionSchema } from './transaction-schema';

/** A transaction as written to CSV: the date as YYYY-MM-DD and the amount exactly as stored. */
export type TransactionExport = {
    date: string;
    accountName: string;
    merchant: string;
    categoryName: string;
    amount: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
};

export interface IFinanceTransactionData {
    search(options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]>;
    retrieveForExport(accountId?: string): Promise<TransactionExport[]>;
    retrieveMerchants(): Promise<string[]>;
    retrieveCashflowByCategory(startDate: CalendarDate, endDate: CalendarDate): Promise<CashflowStream[]>;
    retrieveSingle(id: string): Promise<Transaction | null>;
    insert(transaction: Transaction): Promise<Transaction>;
    /** Inserts all of the transactions or, if any insert fails, none of them. */
    insertBulk(transactions: Transaction[]): Promise<void>;
    update(transaction: Transaction): Promise<Transaction | null>;
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
        isSplit: row.isSplit,
        splitParentId: row.splitParentId ?? ''
    };
}

// Sorting by name ignores case. Ties (same day, same merchant, ...) fall back to newest first, then id, so paging is stable.
function getSearchOrder(sortKey: TransactionsSortKey, direction: SortDirection): SQL[] {
    const columns: Record<TransactionsSortKey, SQL | AnyColumn> = {
        [TransactionsSortKey.Date]: transactionSchema.date,
        [TransactionsSortKey.Amount]: transactionSchema.amount,
        [TransactionsSortKey.Merchant]: transactionSchema.merchant,
        [TransactionsSortKey.Account]: sql`lower(${accountSchema.name})`,
        [TransactionsSortKey.Category]: sql`lower(${categorySchema.name})`,
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
        isSplit: transaction.isSplit,
        splitParentId: transaction.splitParentId || null
    };
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

        if (options.minAmount !== undefined) {
            conditions.push(gte(transactionSchema.amount, String(options.minAmount)));
        }

        if (options.maxAmount !== undefined) {
            conditions.push(lte(transactionSchema.amount, String(options.maxAmount)));
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

        if (options.filters) {
            for (const filter of options.filters) {
                if (filter.key === TransactionsFilterKey.Merchant) {
                    conditions.push(ilike(transactionSchema.merchant, `%${escapeLikePattern(filter.value)}%`));
                }
                else if (filter.key === TransactionsFilterKey.Category) {
                    conditions.push(eq(transactionSchema.categoryId, filter.value));
                }
                else if (filter.key === TransactionsFilterKey.AccountId) {
                    conditions.push(eq(transactionSchema.accountId, filter.value));
                }
                else if (filter.key === TransactionsFilterKey.Group) {
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
            .orderBy(...getSearchOrder(options.sortKey ?? TransactionsSortKey.Date, options.sortDirection ?? SortDirection.Desc))
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
        const rows = await this.db.select({ merchant: transactionSchema.merchant })
            .from(transactionSchema)
            .groupBy(transactionSchema.merchant)
            .orderBy(transactionSchema.merchant);

        return rows.map(row => row.merchant);
    }

    public async retrieveSingle(id: string): Promise<Transaction | null> {
        const rows = await this.db.select()
            .from(transactionSchema)
            .where(eq(transactionSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToTransaction(rows[0]);
    }

    public async retrieveCashflowByCategory(startDate: CalendarDate, endDate: CalendarDate): Promise<CashflowStream[]> {
        const rows = await this.db
            .select({
                categoryId: transactionSchema.categoryId,
                amount: sum(transactionSchema.amount).mapWith(Number)
            })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(and(
                gte(transactionSchema.date, startDate),
                lte(transactionSchema.date, endDate),
                eq(accountSchema.hideFromCashflow, false)
            ))
            .groupBy(transactionSchema.categoryId);

        return rows.map(row => ({
            categoryId: row.categoryId ?? '',
            amount: Number(row.amount)
        }));
    }

    public async insert(transaction: Transaction): Promise<Transaction> {
        const rows = await this.db.insert(transactionSchema)
            .values(mapTransactionToRow(transaction))
            .returning();

        return mapRowToTransaction(rows[0]);
    }

    public async insertBulk(transactions: Transaction[]): Promise<void> {
        // One transaction, so a failure in any chunk rolls back the earlier ones. Chunks keep each
        // statement under Postgres's 65,535 bind-parameter limit (11 columns per row).
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < transactions.length; i += bulkInsertChunkSize) {
                const chunk = transactions.slice(i, i + bulkInsertChunkSize);
                await tx.insert(transactionSchema).values(chunk.map(mapTransactionToRow));
            }
        });
    }

    public async update(transaction: Transaction): Promise<Transaction | null> {
        const rows = await this.db.update(transactionSchema)
            .set({
                accountId: transaction.accountId,
                merchant: transaction.merchant,
                categoryId: transaction.categoryId || null,
                amount: transaction.amount.toString(),
                date: transaction.date,
                originalStatement: transaction.originalStatement || null,
                notes: transaction.notes || null,
                isHidden: transaction.isHidden,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(transactionSchema.id, transaction.id!))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToTransaction(rows[0]);
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db.delete(transactionSchema)
            .where(eq(transactionSchema.id, id))
            .returning({ id: transactionSchema.id });

        return result.length > 0;
    }
}