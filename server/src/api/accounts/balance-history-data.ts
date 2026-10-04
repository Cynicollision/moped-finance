import { eq, and, desc, sum, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarDate } from '@shared/core/types';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

/** A balance as written to CSV: the date as YYYY-MM-DD and the balance exactly as stored. */
export type BalanceHistoryExport = {
    date: string;
    accountName: string;
    balance: string;
};

type Transaction = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

const bulkInsertChunkSize = 1000;

function mapBalanceHistoryToRow(record: BalanceHistory): typeof balanceHistorySchema.$inferInsert {
    return {
        id: record.id,
        accountId: record.accountId,
        date: record.date,
        balance: record.balance.toString(),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(accountId: string, startDate: CalendarDate, endDate: CalendarDate): Promise<BalanceHistory[]>;
    retrieveSumByDate(
        type: ValueHistoryType,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<TotalValueHistory[]>;
    /** Inserts all of the records or, if any insert fails, none of them. */
    insertBulk(records: BalanceHistory[]): Promise<void>;
    /** Replaces the account's balances from startDate to endDate (inclusive) with the records, atomically. */
    replaceRange(
        accountId: string,
        startDate: CalendarDate,
        endDate: CalendarDate,
        records: BalanceHistory[]
    ): Promise<void>;
    retrieveForExport(accountId: string): Promise<BalanceHistoryExport[]>;
}

export class FinanceBalanceHistoryData implements IFinanceBalanceHistoryData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveForAccount(
        accountId: string,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<BalanceHistory[]> {
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
            .where(
                and(
                    eq(balanceHistorySchema.accountId, accountId),
                    gte(balanceHistorySchema.date, startDate),
                    lte(balanceHistorySchema.date, endDate)
                )
            );

        return rows.map(row => ({
            ...row,
            balance: Number(row.balance)
        }));
    }

    public async retrieveSumByDate(
        type: ValueHistoryType,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<TotalValueHistory[]> {
        const conditions = [gte(balanceHistorySchema.date, startDate), lte(balanceHistorySchema.date, endDate)];

        if (type === ValueHistoryType.Assets) {
            conditions.push(eq(accountSchema.category, AccountCategory.Asset));
        } else if (type === ValueHistoryType.Liabilities) {
            conditions.push(eq(accountSchema.category, AccountCategory.Liability));
        }

        const rows = await this.db
            .select({
                date: balanceHistorySchema.date,
                amount: sum(balanceHistorySchema.balance).mapWith(Number)
            })
            .from(balanceHistorySchema)
            .innerJoin(accountSchema, eq(accountSchema.id, balanceHistorySchema.accountId))
            .where(and(...conditions))
            .groupBy(balanceHistorySchema.date)
            .orderBy(desc(balanceHistorySchema.date));

        return rows.map(row => ({
            date: row.date,
            type,
            amount: Number(row.amount)
        }));
    }

    public async insertBulk(records: BalanceHistory[]): Promise<void> {
        await this.db.transaction(async tx => {
            await this.insertChunks(tx, records);
        });
    }

    public async replaceRange(
        accountId: string,
        startDate: CalendarDate,
        endDate: CalendarDate,
        records: BalanceHistory[]
    ): Promise<void> {
        // One transaction, so a failed insert leaves the old balances in place.
        await this.db.transaction(async tx => {
            await tx
                .delete(balanceHistorySchema)
                .where(
                    and(
                        eq(balanceHistorySchema.accountId, accountId),
                        gte(balanceHistorySchema.date, startDate),
                        lte(balanceHistorySchema.date, endDate)
                    )
                );

            await this.insertChunks(tx, records);
        });
    }

    // Chunks keep each statement well under Postgres's 65,535 bind-parameter limit.
    private async insertChunks(tx: Transaction, records: BalanceHistory[]): Promise<void> {
        for (let i = 0; i < records.length; i += bulkInsertChunkSize) {
            const chunk = records.slice(i, i + bulkInsertChunkSize);
            await tx.insert(balanceHistorySchema).values(chunk.map(mapBalanceHistoryToRow));
        }
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
            date: row.date,
            accountName: row.accountName,
            balance: row.balance
        }));
    }
}
