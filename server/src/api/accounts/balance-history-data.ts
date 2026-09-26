import { eq, and, desc, sum, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

export type BalanceHistoryExport = {
    date: string;
    accountName: string;
    balance: number;
};

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]>;
    retrieveSumByDate(type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]>;
    deleteRange(accountId: string, startDate: string, endDate: string): Promise<boolean>;
    insertBulk(records: BalanceHistory[]): Promise<boolean>;
    retrieveForExport(accountId: string): Promise<BalanceHistoryExport[]>;
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
                accountId: balanceHistorySchema.accountId,
                date: balanceHistorySchema.date,
                balance: balanceHistorySchema.balance
            })
            .from(balanceHistorySchema)
            .where(and(...conditions));

        return rows.map(row => ({
            ...row,
            date: DateTimeUtil.parse(row.date),
            balance: Number(row.balance)
        }));
    }

    public async retrieveSumByDate(type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]> {
        const conditions = [
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
        await this.db.delete(balanceHistorySchema)
            .where(and(
                eq(balanceHistorySchema.accountId, accountId),
                gte(balanceHistorySchema.date, DateTimeUtil.toDateString(startDate)),
                lte(balanceHistorySchema.date, DateTimeUtil.toDateString(endDate))
            ));

        return true;
    }

    public async insertBulk(records: BalanceHistory[]): Promise<boolean> {
        if (records.length === 0) return true;

        const values = records.map(r => ({
            id: r.id,
            accountId: r.accountId,
            date: DateTimeUtil.toDateString(r.date),
            balance: r.balance.toString(),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));

        await this.db.insert(balanceHistorySchema).values(values);
        return true;
    }

    public async retrieveForExport(accountId: string): Promise<BalanceHistoryExport[]> {
        const rows = await this.db
            .select({
                date: balanceHistorySchema.date,
                accountName: accountSchema.name,
                balance: balanceHistorySchema.balance
            })
            .from(balanceHistorySchema)
            .innerJoin(accountSchema, eq(accountSchema.id, balanceHistorySchema.accountId))
            .where(eq(balanceHistorySchema.accountId, accountId))
            .orderBy(desc(balanceHistorySchema.date));

        return rows.map(row => ({
            date: DateTimeUtil.toISOString(row.date),
            accountName: row.accountName,
            balance: Number(row.balance)
        }));
    }
}