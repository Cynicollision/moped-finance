import { eq, and, desc, asc, ilike, sum, gte, lte, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortDirection } from '@shared/core/enum';
import { Transaction } from '@shared/finance/types';
import { CashflowStream, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';
import { transactionSchema } from './transaction-schema';

export type TransactionExport = {
    id: string;
    date: string;
    accountName: string;
    merchant: string;
    categoryName: string;
    amount: number;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
};

export interface IFinanceTransactionData {
    search(options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]>;
    retrieveForExport(accountId?: string): Promise<TransactionExport[]>;
    retrieveMerchants(): Promise<string[]>;
    retrieveCashflowByCategory(startDate: Date, endDate: Date): Promise<CashflowStream[]>;
    retrieveSingle(id: string): Promise<Transaction | null>;
    insert(transaction: Transaction): Promise<Transaction>;
    update(transaction: Transaction): Promise<Transaction | null>;
    delete(id: string): Promise<boolean>;
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
                id: transactionSchema.id,
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
            id: row.id,
            date: DateTimeUtil.toISOString(row.date),
            accountName: row.accountName,
            merchant: row.merchant,
            categoryName: row.categoryName ?? '',
            amount: Number(row.amount),
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
                    conditions.push(eq(categorySchema.groupId, filter.value));
                }
            }
        }

        let query = this.db
            .select({
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

    public async retrieveCashflowByCategory(startDate: Date, endDate: Date): Promise<CashflowStream[]> {
        const rows = await this.db
            .select({
                categoryId: transactionSchema.categoryId,
                amount: sum(transactionSchema.amount).mapWith(Number)
            })
            .from(transactionSchema)
            .innerJoin(accountSchema, eq(accountSchema.id, transactionSchema.accountId))
            .where(and(
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

    public async insert(transaction: Transaction): Promise<Transaction> {
        const rows = await this.db.insert(transactionSchema)
            .values({
                id: transaction.id,
                accountId: transaction.accountId,
                categoryId: transaction.categoryId,
                date: DateTimeUtil.toDateString(transaction.date),
                amount: transaction.amount.toString(),
                merchant: transaction.merchant,
                originalStatement: transaction.originalStatement || null,
                notes: transaction.notes || null,
                isHidden: transaction.isHidden,
                isSplit: transaction.isSplit,
                splitParentId: transaction.splitParentId || null
            })
            .returning();

        return mapRowToTransaction(rows[0]);
    }

    public async update(transaction: Transaction): Promise<Transaction | null> {
        const rows = await this.db.update(transactionSchema)
            .set({
                merchant: transaction.merchant,
                categoryId: transaction.categoryId,
                amount: transaction.amount.toString(),
                date: DateTimeUtil.toDateString(transaction.date),
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