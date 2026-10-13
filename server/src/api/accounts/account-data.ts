import { and, asc, eq, desc, gt, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgColumn } from 'drizzle-orm/pg-core';
import { CalendarDate } from '@shared/core/types';
import { Account, AccountBalanceEntry } from '@shared/finance/types';
import { AccountType } from '@shared/finance/enum';
import { AccountTypeUtil } from '@shared/finance/util';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './account-schema';
import { writeSetEntry } from './balance-history-data';
import { balanceHistorySchema } from './balance-history-schema';
import { transactionSchema } from './../transactions/transaction-schema';

/** Accounts come with their balance as of a date: their latest entry on or before it (ACCT-2.1). Default: today. */
export interface IFinanceAccountData {
    retrieveAll(asOfDate?: CalendarDate): Promise<Account[]>;
    retrieveByInstitutionId(institutionId: string, asOfDate?: CalendarDate): Promise<Account[]>;
    retrieveSingle(id: string, asOfDate?: CalendarDate): Promise<Account | null>;
    /** Inserts the account and, if given, its balance as a set entry (ACCT-2.2), together or not at all. */
    insert(account: Account, balanceEntry?: AccountBalanceEntry): Promise<Account>;
    /** Updates the account and, if given, records its balance as a set entry (ACCT-2.2), together or not at all. */
    update(account: Account, balanceEntry?: AccountBalanceEntry): Promise<Account | null>;
    delete(id: string): Promise<boolean>;
    /**
     * Closes the account on the date (ACCT-6.1): removes its balance entries after it and, unless the balance then is
     * already 0, records a set entry of 0 on it, together or not at all. Returns false if there's no such account.
     */
    close(id: string, closedOn: CalendarDate): Promise<boolean>;
    /** Makes the account open again, leaving its balance history as it is (ACCT-6.3). */
    reopen(id: string): Promise<boolean>;
}

function mapRowToAccount(
    row: typeof accountSchema.$inferSelect,
    balance: number | string,
    balanceDate: CalendarDate | null
): Account {
    const type = row.type as AccountType;
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        institutionId: row.institutionId,
        name: row.name,
        type,
        group: AccountTypeUtil.groupOf(type),
        category: AccountTypeUtil.categoryOf(type),
        isHidden: row.isHidden,
        isManual: row.isManual,
        balance: Number(balance),
        balanceDate,
        closedOn: row.closedOn
    };
}

export class FinanceAccountData implements IFinanceAccountData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    // The latest entry's balance and date. Entries after the as-of date are left out, so a future-dated entry
    // never becomes the current balance.
    private latestBalanceFields(asOfDate: CalendarDate) {
        const latest = (column: PgColumn) =>
            this.db
                .select({ value: column })
                .from(balanceHistorySchema)
                .where(
                    and(eq(balanceHistorySchema.accountId, accountSchema.id), lte(balanceHistorySchema.date, asOfDate))
                )
                .orderBy(desc(balanceHistorySchema.date))
                .limit(1);

        return {
            balance: sql<string | number>`COALESCE((${latest(balanceHistorySchema.balance)}), 0)`,
            balanceDate: sql<string | null>`to_char((${latest(balanceHistorySchema.date)}), 'YYYY-MM-DD')`
        };
    }

    // By name, ignoring case (INST-1.1, DASH-2.1).
    private byName() {
        return asc(sql`lower(${accountSchema.name})`);
    }

    public async retrieveAll(asOfDate = DateTimeUtil.today()): Promise<Account[]> {
        const rows = await this.db
            .select({
                account: accountSchema,
                ...this.latestBalanceFields(asOfDate)
            })
            .from(accountSchema)
            .orderBy(this.byName());

        return rows.map(row => mapRowToAccount(row.account, row.balance, row.balanceDate));
    }

    public async retrieveByInstitutionId(institutionId: string, asOfDate = DateTimeUtil.today()): Promise<Account[]> {
        const rows = await this.db
            .select({
                account: accountSchema,
                ...this.latestBalanceFields(asOfDate)
            })
            .from(accountSchema)
            .where(eq(accountSchema.institutionId, institutionId))
            .orderBy(this.byName());

        return rows.map(row => mapRowToAccount(row.account, row.balance, row.balanceDate));
    }

    public async retrieveSingle(accountId: string, asOfDate = DateTimeUtil.today()): Promise<Account | null> {
        const rows = await this.db
            .select({
                account: accountSchema,
                ...this.latestBalanceFields(asOfDate)
            })
            .from(accountSchema)
            .where(eq(accountSchema.id, accountId));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToAccount(rows[0].account, rows[0].balance, rows[0].balanceDate);
    }

    public async insert(account: Account, balanceEntry?: AccountBalanceEntry): Promise<Account> {
        await this.db.transaction(async tx => {
            await tx.insert(accountSchema).values({
                id: account.id,
                institutionId: account.institutionId,
                name: account.name,
                type: account.type,
                isHidden: account.isHidden,
                isManual: account.isManual
            });
            if (balanceEntry) {
                await writeSetEntry(tx, account.id, balanceEntry);
            }
        });

        return (await this.retrieveSingle(account.id))!;
    }

    public async update(account: Account, balanceEntry?: AccountBalanceEntry): Promise<Account | null> {
        const updated = await this.db.transaction(async tx => {
            const rows = await tx
                .update(accountSchema)
                .set({
                    institutionId: account.institutionId,
                    name: account.name,
                    type: account.type,
                    isHidden: account.isHidden,
                    isManual: account.isManual,
                    updatedAt: DateTimeUtil.now()
                })
                .where(eq(accountSchema.id, account.id))
                .returning({ id: accountSchema.id });
            if (rows.length > 0 && balanceEntry) {
                await writeSetEntry(tx, account.id, balanceEntry);
            }
            return rows.length > 0;
        });

        return updated ? this.retrieveSingle(account.id) : null;
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(accountSchema)
            .where(eq(accountSchema.id, id))
            .returning({ id: accountSchema.id });

        return result.length > 0;
    }

    public async close(id: string, closedOn: CalendarDate): Promise<boolean> {
        return this.db.transaction(async tx => {
            const rows = await tx
                .update(accountSchema)
                .set({ closedOn, updatedAt: DateTimeUtil.now() })
                .where(eq(accountSchema.id, id))
                .returning({ id: accountSchema.id });
            if (rows.length === 0) {
                return false;
            }

            // The account held nothing after it closed. Transactions after that no longer adjust the balance, since
            // their entries are gone (ACCT-6.1).
            await tx
                .delete(balanceHistorySchema)
                .where(and(eq(balanceHistorySchema.accountId, id), gt(balanceHistorySchema.date, closedOn)));
            await tx
                .update(transactionSchema)
                .set({ adjustsBalance: false, updatedAt: DateTimeUtil.now() })
                .where(
                    and(
                        eq(transactionSchema.accountId, id),
                        gt(transactionSchema.date, closedOn),
                        eq(transactionSchema.adjustsBalance, true)
                    )
                );

            const [latest] = await tx
                .select({ balance: balanceHistorySchema.balance })
                .from(balanceHistorySchema)
                .where(and(eq(balanceHistorySchema.accountId, id), lte(balanceHistorySchema.date, closedOn)))
                .orderBy(desc(balanceHistorySchema.date))
                .limit(1);
            if (latest && Number(latest.balance) !== 0) {
                await writeSetEntry(tx, id, { date: closedOn, balance: 0 });
            }
            return true;
        });
    }

    public async reopen(id: string): Promise<boolean> {
        const rows = await this.db
            .update(accountSchema)
            .set({ closedOn: null, updatedAt: DateTimeUtil.now() })
            .where(eq(accountSchema.id, id))
            .returning({ id: accountSchema.id });

        return rows.length > 0;
    }
}
