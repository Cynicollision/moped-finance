import { eq, and, asc, desc, gt, gte, inArray, lt, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarDate } from '@shared/core/types';
import { AccountGroupChange, DailyBalance, TotalValueHistory } from '@shared/finance/contracts';
import { AccountType, ValueHistoryType, AccountCategory, BalanceEntrySource } from '@shared/finance/enum';
import { AccountBalanceEntry, BalanceHistory } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { DbTransaction, EntityFactory, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

/** A balance as written to CSV: the date as YYYY-MM-DD and the balance exactly as stored. */
export interface BalanceHistoryExport {
    date: string;
    accountName: string;
    balance: string;
}

const bulkInsertChunkSize = 1000;

function mapBalanceHistoryToRow(record: BalanceHistory): typeof balanceHistorySchema.$inferInsert {
    return {
        id: record.id,
        accountId: record.accountId,
        date: record.date,
        balance: record.balance.toString(),
        source: record.source,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

/** The account's latest entry on or before the date: the balance carried to it. None if it has no entry by then. */
async function retrieveCarried(
    tx: DbTransaction,
    accountId: string,
    date: CalendarDate
): Promise<{ date: CalendarDate; balance: number } | undefined> {
    const [latest] = await tx
        .select({ date: balanceHistorySchema.date, balance: balanceHistorySchema.balance })
        .from(balanceHistorySchema)
        .where(and(eq(balanceHistorySchema.accountId, accountId), lte(balanceHistorySchema.date, date)))
        .orderBy(desc(balanceHistorySchema.date))
        .limit(1);
    return latest && { date: latest.date, balance: Number(latest.balance) };
}

/**
 * Adds the amount to the account's entries after the date (and on it, with `includeDate`), up to but not including the
 * first set entry after it, which is a checkpoint that already counts everything before it (ACCT-5.2, ACCT-5.7).
 */
async function shiftUntilNextSetEntry(
    tx: DbTransaction,
    accountId: string,
    date: CalendarDate,
    amount: number,
    includeDate: boolean
): Promise<void> {
    const [nextSet] = await tx
        .select({ date: balanceHistorySchema.date })
        .from(balanceHistorySchema)
        .where(
            and(
                eq(balanceHistorySchema.accountId, accountId),
                gt(balanceHistorySchema.date, date),
                eq(balanceHistorySchema.source, BalanceEntrySource.Set)
            )
        )
        .orderBy(asc(balanceHistorySchema.date))
        .limit(1);

    await tx
        .update(balanceHistorySchema)
        .set({
            balance: sql`${balanceHistorySchema.balance} + ${amount.toFixed(2)}::numeric`,
            updatedAt: DateTimeUtil.now()
        })
        .where(
            and(
                eq(balanceHistorySchema.accountId, accountId),
                includeDate ? gte(balanceHistorySchema.date, date) : gt(balanceHistorySchema.date, date),
                nextSet ? lt(balanceHistorySchema.date, nextSet.date) : undefined
            )
        );
}

/**
 * Records a balance the user entered as a set entry (ACCT-2.2, ACCT-5.1), replacing any entry on that date, and moves
 * the adjusted entries after it by as much as it changed the balance there (ACCT-5.7). Part of a larger write, so it
 * takes the caller's database transaction.
 */
export async function writeSetEntry(tx: DbTransaction, accountId: string, entry: AccountBalanceEntry): Promise<void> {
    const carried = await retrieveCarried(tx, accountId, entry.date);
    const record = EntityFactory.createBalanceHistory({ accountId, ...entry, source: BalanceEntrySource.Set });
    await tx
        .insert(balanceHistorySchema)
        .values(mapBalanceHistoryToRow(record))
        .onConflictDoUpdate({
            target: [balanceHistorySchema.accountId, balanceHistorySchema.date],
            set: { balance: record.balance.toString(), source: record.source, updatedAt: record.updatedAt }
        });

    // In cents, so float error can't make an unchanged balance look changed.
    await shiftAfterSetEntry(tx, accountId, entry.date, entry.balance - (carried?.balance ?? 0));
}

/**
 * Moves the adjusted entries after a new set entry by as much as it changed the balance on its date, up to the next
 * set entry, so each stays its checkpoint plus the transactions since (ACCT-5.7).
 */
async function shiftAfterSetEntry(tx: DbTransaction, accountId: string, date: CalendarDate, change: number) {
    // In cents, so float error can't make an unchanged balance look changed.
    const cents = Math.round(change * 100);
    if (cents !== 0) {
        await shiftUntilNextSetEntry(tx, accountId, date, cents / 100, false);
    }
}

/**
 * Applies a transaction that adjusts the balance (ACCT-5.2): adds its amount to the account's entries from its date up
 * to the first set entry after it, first creating an adjusted entry on its date, at the balance carried to it, if
 * there's none. An entry on its own date shifts even if it's a set entry.
 */
export async function applyAdjustment(
    tx: DbTransaction,
    accountId: string,
    date: CalendarDate,
    amount: number
): Promise<void> {
    const carried = await retrieveCarried(tx, accountId, date);
    if (carried?.date !== date) {
        const record = EntityFactory.createBalanceHistory({
            accountId,
            date,
            balance: carried?.balance ?? 0,
            source: BalanceEntrySource.Adjusted
        });
        await tx.insert(balanceHistorySchema).values(mapBalanceHistoryToRow(record));
    }
    await shiftUntilNextSetEntry(tx, accountId, date, amount, true);
}

/**
 * Undoes a transaction's adjustment (ACCT-5.3) over the same range as the entries stand now. Unlike applying, it
 * creates no entry: a date without one has had its balances replaced since (by an import or by closing), which
 * already left the transaction out.
 */
export async function undoAdjustment(
    tx: DbTransaction,
    accountId: string,
    date: CalendarDate,
    amount: number
): Promise<void> {
    await shiftUntilNextSetEntry(tx, accountId, date, -amount, true);
}

export interface IBalanceHistoryData {
    /** The account's balance on every day from startDate to endDate (ACCT-2.11), as `retrieveSumByDate`. */
    retrieveDailyForAccount(accountId: string, startDate: CalendarDate, endDate: CalendarDate): Promise<DailyBalance[]>;
    /**
     * The total of the type's accounts, hidden ones left out, on every day from startDate to endDate, oldest first,
     * carrying each account's entries forward (DASH-1.4). Days before the first entry are left out.
     */
    retrieveSumByDate(
        type: ValueHistoryType,
        startDate: CalendarDate,
        endDate: CalendarDate
    ): Promise<TotalValueHistory[]>;
    /**
     * Each account group's daily total on its first day from startDate to endDate and on endDate (DASH-2.2), in the
     * groups' display order (ACCT-1.2). Hidden accounts and groups with no entry by endDate are left out.
     */
    retrieveGroupChanges(startDate: CalendarDate, endDate: CalendarDate): Promise<AccountGroupChange[]>;
    /** Inserts all of the records or, if any insert fails, none of them. */
    insertBulk(records: BalanceHistory[]): Promise<void>;
    /**
     * Replaces the account's balances from startDate to endDate (inclusive) with the records, atomically, and moves
     * the adjusted entries after endDate by as much as the record on endDate changed the balance there (ACCT-5.7).
     */
    replaceRange(
        accountId: string,
        startDate: CalendarDate,
        endDate: CalendarDate,
        records: BalanceHistory[]
    ): Promise<void>;
    retrieveForExport(accountId: string): Promise<BalanceHistoryExport[]>;
}

export class BalanceHistoryData implements IBalanceHistoryData {
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
        // Hidden accounts are left out on every day (DASH-1.4, ACCT-1.9).
        const accounts = [eq(accountSchema.isHidden, false)];
        if (type === ValueHistoryType.Assets) {
            accounts.push(inArray(accountSchema.type, AccountTypeUtil.typesIn(AccountCategory.Asset)));
        } else if (type === ValueHistoryType.Liabilities) {
            accounts.push(inArray(accountSchema.type, AccountTypeUtil.typesIn(AccountCategory.Liability)));
        }

        const days = await this.retrieveDailyTotals(and(...accounts)!, startDate, endDate);
        return days.map(day => ({ ...day, type }));
    }

    public async retrieveGroupChanges(startDate: CalendarDate, endDate: CalendarDate): Promise<AccountGroupChange[]> {
        // Each unhidden account's first day (startDate, or its first entry if later) with its balance then and on
        // endDate (DASH-2.9).
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
            WHERE NOT ${accountSchema.isHidden}
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
            const carried = await retrieveCarried(tx, accountId, endDate);
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

            const last = records.find(record => record.date === endDate);
            if (last) {
                await shiftAfterSetEntry(tx, accountId, endDate, last.balance - (carried?.balance ?? 0));
            }
        });
    }

    // Chunks keep each statement well under Postgres's 65,535 bind-parameter limit.
    private async insertChunks(tx: DbTransaction, records: BalanceHistory[]): Promise<void> {
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
