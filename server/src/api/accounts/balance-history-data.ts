import { eq, and, desc, gte, inArray, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarDate } from '@shared/core/types';
import { AccountGroupChange, DailyBalance, TotalValueHistory } from '@shared/finance/contracts';
import { AccountType, ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { IDatabaseClient } from '@server/data';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

/** A balance as written to CSV: the date as YYYY-MM-DD and the balance exactly as stored. */
export interface BalanceHistoryExport {
    date: string;
    accountName: string;
    balance: string;
}

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
    /** The account's balance on every day from startDate to endDate (ACCT-2.11), as `retrieveSumByDate`. */
    retrieveDailyForAccount(accountId: string, startDate: CalendarDate, endDate: CalendarDate): Promise<DailyBalance[]>;
    /**
     * The total of the type's accounts on every day from startDate to endDate, oldest first, carrying each account's
     * entries forward (DASH-1.4). Days before the first entry are left out.
     */
    retrieveSumByDate(
        type: ValueHistoryType,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<TotalValueHistory[]>;
    /**
     * Each account group's daily total on its first day from startDate to endDate and on endDate (DASH-2.2), in the
     * groups' display order (ACCT-1.2). Groups with no entry by endDate are left out.
     */
    retrieveGroupChanges(startDate: CalendarDate, endDate: CalendarDate): Promise<AccountGroupChange[]>;
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

    public async retrieveDailyForAccount(
        accountId: string,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<DailyBalance[]> {
        const days = await this.retrieveDailyTotals(eq(balanceHistorySchema.accountId, accountId), startDate, endDate);
        return days.map(day => ({ date: day.date, balance: day.amount }));
    }

    public async retrieveSumByDate(
        type: ValueHistoryType,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<TotalValueHistory[]> {
        let accounts = sql`true`;
        if (type === ValueHistoryType.Assets) {
            accounts = inArray(accountSchema.type, AccountTypeUtil.typesIn(AccountCategory.Asset));
        } else if (type === ValueHistoryType.Liabilities) {
            accounts = inArray(accountSchema.type, AccountTypeUtil.typesIn(AccountCategory.Liability));
        }

        const days = await this.retrieveDailyTotals(accounts, startDate, endDate);
        return days.map(day => ({ ...day, type }));
    }

    public async retrieveGroupChanges(startDate: CalendarDate, endDate: CalendarDate): Promise<AccountGroupChange[]> {
        // Each account's first day (startDate, or its first entry if later) with its balance then and on endDate.
        const result = await this.db.execute<{
            type: AccountType;
            first_day: string;
            start_balance: string;
            end_balance: string;
        }>(sql`
            WITH entries AS (
                SELECT
                    ${balanceHistorySchema.accountId} AS account_id,
                    ${balanceHistorySchema.date} AS date,
                    ${balanceHistorySchema.balance} AS balance
                FROM ${balanceHistorySchema}
                WHERE ${balanceHistorySchema.date} <= ${endDate}
            ),
            first_days AS (
                SELECT account_id, GREATEST(${startDate}::date, min(date)) AS first_day
                FROM entries
                GROUP BY account_id
            )
            SELECT
                ${accountSchema.type} AS type,
                to_char(first_days.first_day, 'YYYY-MM-DD') AS first_day,
                (
                    SELECT balance FROM entries
                    WHERE entries.account_id = first_days.account_id AND entries.date <= first_days.first_day
                    ORDER BY entries.date DESC LIMIT 1
                ) AS start_balance,
                (
                    SELECT balance FROM entries
                    WHERE entries.account_id = first_days.account_id
                    ORDER BY entries.date DESC LIMIT 1
                ) AS end_balance
            FROM first_days
            INNER JOIN ${accountSchema} ON ${accountSchema.id} = first_days.account_id
        `);

        // A group starts on its accounts' earliest first day; an account whose first day is later adds nothing then.
        return AccountTypeUtil.groups.flatMap(info => {
            const rows = result.rows.filter(row => AccountTypeUtil.groupOf(row.type) === info.group);
            if (rows.length === 0) {
                return [];
            }
            const startDate = rows.map(row => row.first_day).reduce((a, b) => (a < b ? a : b));
            const sum = (values: string[]) => values.reduce((total, value) => total + Number(value), 0);
            return [
                {
                    group: info.group,
                    startDate,
                    startAmount: sum(rows.filter(row => row.first_day === startDate).map(row => row.start_balance)),
                    endAmount: sum(rows.map(row => row.end_balance))
                }
            ];
        });
    }

    /**
     * Totals the balances of the accounts matching `accounts` for every day from startDate to endDate, oldest first.
     * Each account counts its latest entry on or before the day; one with no entry yet adds nothing. The days start
     * at the first entry when that's later than startDate, so there are none before any account has a balance.
     */
    private async retrieveDailyTotals(
        accounts: SQL,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<{ date: CalendarDate; amount: number }[]> {
        // Each entry holds from its date until the account's next entry (next_date, exclusive).
        const result = await this.db.execute<{ date: string; amount: string }>(sql`
            WITH entries AS (
                SELECT
                    ${balanceHistorySchema.date} AS date,
                    ${balanceHistorySchema.balance} AS balance,
                    LEAD(${balanceHistorySchema.date}) OVER (
                        PARTITION BY ${balanceHistorySchema.accountId} ORDER BY ${balanceHistorySchema.date}
                    ) AS next_date
                FROM ${balanceHistorySchema}
                INNER JOIN ${accountSchema} ON ${accountSchema.id} = ${balanceHistorySchema.accountId}
                WHERE ${accounts} AND ${balanceHistorySchema.date} <= ${endDate}
            ),
            days AS (
                SELECT generate_series(
                    GREATEST(${startDate}::date, (SELECT min(date) FROM entries)),
                    ${endDate}::date,
                    interval '1 day'
                )::date AS day
            )
            SELECT to_char(days.day, 'YYYY-MM-DD') AS date, sum(entries.balance) AS amount
            FROM days
            INNER JOIN entries
                ON entries.date <= days.day AND (entries.next_date IS NULL OR entries.next_date > days.day)
            GROUP BY days.day
            ORDER BY days.day
        `);

        return result.rows.map(row => ({ date: row.date, amount: Number(row.amount) }));
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
