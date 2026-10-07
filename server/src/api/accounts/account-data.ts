import { and, asc, eq, desc, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarDate } from '@shared/core/types';
import { Account } from '@shared/finance/types';
import { AccountType } from '@shared/finance/enum';
import { AccountTypeUtil } from '@shared/finance/util';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

/** Accounts come with their balance as of a date: their latest entry on or before it (ACCT-2.1). Default: today. */
export interface IFinanceAccountData {
    retrieveAll(asOfDate?: CalendarDate): Promise<Account[]>;
    retrieveByInstitutionId(institutionId: string, asOfDate?: CalendarDate): Promise<Account[]>;
    retrieveSingle(id: string, asOfDate?: CalendarDate): Promise<Account | null>;
    insert(account: Account): Promise<Account>;
    update(account: Account): Promise<Account | null>;
    delete(id: string): Promise<boolean>;
}

function mapRowToAccount(row: typeof accountSchema.$inferSelect, balance: number | string): Account {
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
        hideFromSpending: row.hideFromSpending,
        balance: Number(balance)
    };
}

export class FinanceAccountData implements IFinanceAccountData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    // Entries after the as-of date are left out, so a future-dated entry never becomes the current balance.
    private getLatestBalanceSubquery(asOfDate: CalendarDate) {
        return this.db
            .select({ balance: balanceHistorySchema.balance })
            .from(balanceHistorySchema)
            .where(and(eq(balanceHistorySchema.accountId, accountSchema.id), lte(balanceHistorySchema.date, asOfDate)))
            .orderBy(desc(balanceHistorySchema.date))
            .limit(1);
    }

    // By name, ignoring case (INST-1.1, DASH-2.1).
    private byName() {
        return asc(sql`lower(${accountSchema.name})`);
    }

    public async retrieveAll(asOfDate = DateTimeUtil.today()): Promise<Account[]> {
        const rows = await this.db
            .select({
                account: accountSchema,
                balance: sql<string | number>`COALESCE((${this.getLatestBalanceSubquery(asOfDate)}), 0)`
            })
            .from(accountSchema)
            .orderBy(this.byName());

        return rows.map(row => mapRowToAccount(row.account, row.balance));
    }

    public async retrieveByInstitutionId(institutionId: string, asOfDate = DateTimeUtil.today()): Promise<Account[]> {
        const rows = await this.db
            .select({
                account: accountSchema,
                balance: sql<string | number>`COALESCE((${this.getLatestBalanceSubquery(asOfDate)}), 0)`
            })
            .from(accountSchema)
            .where(eq(accountSchema.institutionId, institutionId))
            .orderBy(this.byName());

        return rows.map(row => mapRowToAccount(row.account, row.balance));
    }

    public async retrieveSingle(accountId: string, asOfDate = DateTimeUtil.today()): Promise<Account | null> {
        const rows = await this.db
            .select({
                account: accountSchema,
                balance: sql<string | number>`COALESCE((${this.getLatestBalanceSubquery(asOfDate)}), 0)`
            })
            .from(accountSchema)
            .where(eq(accountSchema.id, accountId));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToAccount(rows[0].account, rows[0].balance);
    }

    public async insert(account: Account): Promise<Account> {
        const rows = await this.db
            .insert(accountSchema)
            .values({
                id: account.id,
                institutionId: account.institutionId,
                name: account.name,
                type: account.type,
                isHidden: account.isHidden,
                isManual: account.isManual,
                hideFromSpending: account.hideFromSpending
            })
            .returning();

        return mapRowToAccount(rows[0], 0);
    }

    public async update(account: Account): Promise<Account | null> {
        const rows = await this.db
            .update(accountSchema)
            .set({
                institutionId: account.institutionId,
                name: account.name,
                type: account.type,
                isHidden: account.isHidden,
                isManual: account.isManual,
                hideFromSpending: account.hideFromSpending,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(accountSchema.id, account.id))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        const balanceResult = await this.retrieveSingle(account.id);

        return {
            ...mapRowToAccount(rows[0], 0),
            balance: balanceResult ? balanceResult.balance : 0
        };
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(accountSchema)
            .where(eq(accountSchema.id, id))
            .returning({ id: accountSchema.id });

        return result.length > 0;
    }
}
