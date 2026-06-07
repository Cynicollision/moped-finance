import { eq, and, desc, sum, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { DateTimeUtil } from '@core/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]>;
    retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]>;
}

export class FinanceBalanceHistoryData implements IFinanceBalanceHistoryData {
    constructor(private db: NodePgDatabase) { }

    public async retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]> {
        const conditions = [
            eq(accountSchema.userId, userId),
            eq(balanceHistorySchema.accountId, accountId)
        ];

        if (startDate) {
            conditions.push(gte(balanceHistorySchema.date, DateTimeUtil.toDateString(startDate)));
        }

        if (endDate) {
            conditions.push(lte(balanceHistorySchema.date, DateTimeUtil.toDateString(endDate)));
        }

        const rows = await this.db.select({
            id: balanceHistorySchema.id,
            createdAt: balanceHistorySchema.createdAt,
            updatedAt: balanceHistorySchema.updatedAt,
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
}