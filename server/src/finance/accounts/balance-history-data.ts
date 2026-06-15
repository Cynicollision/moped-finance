import { eq, and, desc, sum, gte, lte, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { IDatabaseClient } from '@server-core/db-client';
import { DateTimeUtil } from '@server-core/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]>;
    retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]>;
    deleteRange(accountId: string, startDate: string, endDate: string): Promise<boolean>;
    insertBulk(records: BalanceHistory[]): Promise<boolean>;
    exportSearch(accountId: string): Promise<any[]>;
}

export class FinanceBalanceHistoryData implements IFinanceBalanceHistoryData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveForAccount(accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]> {
        const conditions = [
            eq(balanceHistorySchema.accountId, accountId)
        ];

        if (startDate) {
            conditions.push(gte(balanceHistorySchema.date, DateTimeUtil.toDateString(startDate)));
        }

        if (endDate) {
            conditions.push(lte(balanceHistorySchema.date, DateTimeUtil.toDateString(endDate)));
        }

        const rows = await this.db
            .select({
                id: balanceHistorySchema.id,
                createdAt: balanceHistorySchema.createdAt,
                updatedAt: balanceHistorySchema.updatedAt,
                userId: balanceHistorySchema.userId,
                accountId: balanceHistorySchema.accountId,
                date: balanceHistorySchema.date,
                balance: balanceHistorySchema.balance
            })
            .from(balanceHistorySchema)
            .innerJoin(accountSchema, eq(accountSchema.id, balanceHistorySchema.accountId))
            .where(and(...conditions));

        return rows.map(row => ({
            ...row,
            date: DateTimeUtil.parse(row.date),
            balance: Number(row.balance)
        }));
    }

    public async retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]> {
        const conditions = [
            eq(accountSchema.userId, userId),
            gte(balanceHistorySchema.date, DateTimeUtil.toDateString(startDate)),
            lte(balanceHistorySchema.date, DateTimeUtil.toDateString(endDate))
        ];

        if (type === ValueHistoryType.Assets) {
            conditions.push(eq(accountSchema.category, AccountCategory.Asset));
        } else if (type === ValueHistoryType.Liabilities) {
            conditions.push(eq(accountSchema.category, AccountCategory.Liability));
        }

        const rows = await this.db.select({
            date: balanceHistorySchema.date,
            amount: sum(balanceHistorySchema.balance).mapWith(Number)
        })
            .from(balanceHistorySchema)
            .innerJoin(accountSchema, eq(accountSchema.id, balanceHistorySchema.accountId))
            .where(and(...conditions))
            .groupBy(balanceHistorySchema.date)
            .orderBy(desc(balanceHistorySchema.date));

        return rows.map(row => ({
            date: DateTimeUtil.parse(row.date),
            type,
            amount: Number(row.amount)
        }));
    }

    public async deleteRange(accountId: string, startDate: string, endDate: string): Promise<boolean> {
        const userAccountsQuery = this.db.select({ id: accountSchema.id })
            .from(accountSchema)
            .where(eq(accountSchema.id, accountId));

        await this.db.delete(balanceHistorySchema)
            .where(and(
                eq(balanceHistorySchema.accountId, accountId),
                inArray(balanceHistorySchema.accountId, userAccountsQuery),
                gte(balanceHistorySchema.date, DateTimeUtil.toDateString(startDate)),
                lte(balanceHistorySchema.date, DateTimeUtil.toDateString(endDate))
            ));

        return true;
    }

    public async insertBulk(records: BalanceHistory[]): Promise<boolean> {
        if (records.length === 0) return true;

        const values = records.map(r => ({
            id: r.id,
            userId: r.userId,
            accountId: r.accountId,
            date: DateTimeUtil.toDateString(r.date),
            balance: r.balance.toString(),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));

        await this.db.insert(balanceHistorySchema).values(values);
        return true;
    }

    // TODO: return type
    public async exportSearch(accountId: string): Promise<any> {
        const rows = await this.db.select({
            date: balanceHistorySchema.date,
            accountName: accountSchema.name,
            balance: balanceHistorySchema.balance
        })
            .from(balanceHistorySchema)
            .innerJoin(accountSchema, eq(accountSchema.id, balanceHistorySchema.accountId))
            .where(eq(balanceHistorySchema.accountId, accountId))
            .orderBy(desc(balanceHistorySchema.date));

        return rows.map(row => ({
            Date: row.date,
            AccountName: row.accountName,
            Balance: Number(row.balance)
        }));
    }
}