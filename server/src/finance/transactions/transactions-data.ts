import { eq, and, desc, asc, ilike, sum, inArray, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortDirection } from '@shared/core/enum';
import { Transaction } from '@shared/finance/types';
import { SpendingStream, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { IOwnedResourceData } from '@core/interfaces';
import { DateTimeUtil } from '@core/utility';
import { transactionSchema } from './transactions-schema';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';

export interface IFinanceTransactionsData extends IOwnedResourceData<Transaction> {
    search(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]>;
    retrieveMerchants(userId: string): Promise<string[]>;
    retrieveSpendingByCategory(userId: string, startDate: Date, endDate: Date): Promise<SpendingStream[]>;
    retrieveSingle(userId: string, id: string): Promise<Transaction | null>;
    insert(userId: string, transaction: Transaction): Promise<Transaction>;
    update(userId: string, transaction: Transaction): Promise<Transaction | null>;
    delete(userId: string, id: string): Promise<boolean>;
}

function mapRowToTransaction(row: typeof transactionSchema.$inferSelect): Transaction {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        accountId: row.accountId,
        categoryId: row.categoryId,
        date: DateTimeUtil.toISOString(row.date),
        amount: Number(row.amount),
        merchant: row.merchant,
        originalStatement: row.originalStatement ?? '',
        notes: row.notes ?? '',
        isHidden: row.isHidden,
        isSplit: row.isSplit,
        splitParentId: row.splitParentId ?? ''
    };
}

export class FinanceTransactionsData implements IFinanceTransactionsData {
    constructor(private db: NodePgDatabase) { }

    public async search(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
        const conditions = [
            eq(accountSchema.userId, userId)
        ];

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
            conditions.push(gte(transactionSchema.date, DateTimeUtil.toDateString(options.startDate)));
        }

        if (options.endDate) {
            conditions.push(lte(transactionSchema.date, DateTimeUtil.toDateString(options.endDate)));
        }

        if (!options.includeHidden) {
            conditions.push(eq(transactionSchema.isHidden, false));
        }

        if (options.filters) {
            for (const filter of options.filters) {
                if (filter.key === TransactionsFilterKey.Merchant) {
                    conditions.push(ilike(transactionSchema.merchant, `%${filter.value}%`));
                }
                else if (filter.key === TransactionsFilterKey.Category) {
                    conditions.push(eq(transactionSchema.categoryId, filter.value));
                }
                else if (filter.key === TransactionsFilterKey.AccountId) {
                    conditions.push(eq(transactionSchema.accountId, filter.value));
                }
                else if (filter.key === TransactionsFilterKey.Group) {
                    conditions.push(eq(categorySchema.group, filter.value));
                }
            }
        }

        let query = this.db.select({
            transaction: transactionSchema
        })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .innerJoin(categorySchema, eq(categorySchema.id, transactionSchema.categoryId))
            .where(and(...conditions));

        const sort = Object.values(TransactionsSortKey).includes(options.sortKey as TransactionsSortKey)
            ? options.sortKey
            : TransactionsSortKey.Date;

        const dirInput = (options.sortDirection || '').toUpperCase();
        const dir = Object.values(SortDirection).includes(dirInput as SortDirection) ? dirInput : SortDirection.Desc;

        // Apply sorting
        let orderFn;
        switch (sort) {
            case TransactionsSortKey.Date:
                orderFn = dir === SortDirection.Asc ? asc(transactionSchema.date) : desc(transactionSchema.date);
                break;
            case TransactionsSortKey.Amount:
                orderFn = dir === SortDirection.Asc ? asc(transactionSchema.amount) : desc(transactionSchema.amount);
                break;
            case TransactionsSortKey.Merchant:
                orderFn = dir === SortDirection.Asc ? asc(transactionSchema.merchant) : desc(transactionSchema.merchant);
                break;
            default:
                orderFn = desc(transactionSchema.date);
        }

        query = query.orderBy(orderFn, asc(transactionSchema.id)) as any;

        if (options.limit !== undefined) {
            query = query.limit(options.limit) as any;
        }

        if (options.offset !== undefined) {
            query = query.offset(options.offset) as any;
        }

        const rows = await query;
        return rows.map(row => mapRowToTransaction(row.transaction));
    }

    public async retrieveMerchants(userId: string): Promise<string[]> {
        const rows = await this.db.select({ merchant: transactionSchema.merchant })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(eq(accountSchema.userId, userId))
            .groupBy(transactionSchema.merchant)
            .orderBy(transactionSchema.merchant);

        return rows.map(row => row.merchant);
    }

    public async retrieveSingle(userId: string, id: string): Promise<Transaction | null> {
        const rows = await this.db.select({ transaction: transactionSchema })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(and(
                eq(accountSchema.userId, userId),
                eq(transactionSchema.id, id)
            ));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToTransaction(rows[0].transaction);
    }

    public async retrieveSpendingByCategory(userId: string, startDate: Date, endDate: Date): Promise<SpendingStream[]> {
        const rows = await this.db.select({
            categoryId: transactionSchema.categoryId,
            amount: sum(transactionSchema.amount).mapWith(Number)
        })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(and(
                eq(accountSchema.userId, userId),
                gte(transactionSchema.date, DateTimeUtil.toDateString(startDate)),
                lte(transactionSchema.date, DateTimeUtil.toDateString(endDate)),
                eq(accountSchema.hideFromCashflow, false)
            ))
            .groupBy(transactionSchema.categoryId);

        return rows.map(row => ({
            categoryId: row.categoryId,
            amount: Number(row.amount)
        }));
    }

    public async insert(userId: string, transaction: Transaction): Promise<Transaction> {
        const rows = await this.db.insert(transactionSchema)
            .values({
                id: transaction.id,
                accountId: transaction.accountId,
                categoryId: transaction.categoryId,
                date: DateTimeUtil.toDateString(transaction.date),
                amount: transaction.amount.toString(),
                merchant: transaction.merchant,
                originalStatement: transaction.originalStatement,
                notes: transaction.notes,
                isHidden: transaction.isHidden,
                isSplit: transaction.isSplit,
                splitParentId: transaction.splitParentId
            })
            .returning();

        return mapRowToTransaction(rows[0]);
    }

    public async update(userId: string, transaction: Transaction): Promise<Transaction | null> {
        const userAccountsQuery = this.db.select({ id: accountSchema.id })
            .from(accountSchema)
            .where(eq(accountSchema.userId, userId));

        const rows = await this.db.update(transactionSchema)
            .set({
                merchant: transaction.merchant,
                categoryId: transaction.categoryId,
                date: DateTimeUtil.toDateString(transaction.date),
                notes: transaction.notes,
                isHidden: transaction.isHidden,
                updatedAt: DateTimeUtil.now()
            })
            .where(and(
                eq(transactionSchema.id, transaction.id!),
                inArray(transactionSchema.accountId, userAccountsQuery)
            ))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToTransaction(rows[0]);
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const userAccountsQuery = this.db.select({ id: accountSchema.id })
            .from(accountSchema)
            .where(eq(accountSchema.userId, userId));

        const result = await this.db.delete(transactionSchema)
            .where(and(
                eq(transactionSchema.id, id),
                inArray(transactionSchema.accountId, userAccountsQuery)
            ));

        return (result.rowCount ?? 0) > 0;
    }
}