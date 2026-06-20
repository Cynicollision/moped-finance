import { eq, and, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Account } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { IDatabaseClient } from '@server-core/db-client';
import { IOwnedResourceData } from '@server-core/interfaces';
import { DateTimeUtil } from '@server-core/utility';
import { accountSchema } from './account-schema';
import { balanceHistorySchema } from './balance-history-schema';

export interface IFinanceAccountData extends IOwnedResourceData<Account> {
    retrieveAll(userId: string): Promise<Account[]>;
}

function mapRowToAccount(row: typeof accountSchema.$inferSelect, balance: number | string): Account {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        institutionId: row.institutionId,
        name: row.name,
        category: row.category as AccountCategory,
        group: row.group as AccountGroup,
        type: (row.type as AccountType) ?? undefined,
        isHidden: row.isHidden,
        isManual: row.isManual,
        isRetirement: row.isRetirement,
        hideFromCashflow: row.hideFromCashflow,
        balance: Number(balance)
    };
}

export class FinanceAccountData implements IFinanceAccountData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    private getLatestBalanceSubquery() {
        return this.db.select({ balance: balanceHistorySchema.balance })
            .from(balanceHistorySchema)
            .where(eq(balanceHistorySchema.accountId, accountSchema.id))
            .orderBy(desc(balanceHistorySchema.date))
            .limit(1);
    }

    public async retrieveAll(userId: string): Promise<Account[]> {
        const rows = await this.db
            .select({
                account: accountSchema,
                balance: sql<string | number>`COALESCE((${this.getLatestBalanceSubquery()}), 0)`
            })
            .from(accountSchema)
            .where(eq(accountSchema.userId, userId));

        return rows.map(row => mapRowToAccount(row.account, row.balance));
    }

    public async retrieveSingle(accountId: string): Promise<Account | null> {
        const rows = await this.db
            .select({
                account: accountSchema,
                balance: sql<string | number>`COALESCE((${this.getLatestBalanceSubquery()}), 0)`
            })
            .from(accountSchema)
            .where(eq(accountSchema.id, accountId));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToAccount(rows[0].account, rows[0].balance);
    }

    public async insert(account: Account): Promise<Account> {
        const rows = await this.db.insert(accountSchema)
            .values({
                id: account.id,
                userId: account.userId,
                institutionId: account.institutionId,
                name: account.name,
                category: account.category,
                group: account.group,
                type: account.type,
                isHidden: account.isHidden,
                isManual: account.isManual,
                isRetirement: account.isRetirement,
                hideFromCashflow: account.hideFromCashflow
            })
            .returning();

        return mapRowToAccount(rows[0], 0);
    }

    public async update(account: Account): Promise<Account | null> {
        const rows = await this.db.update(accountSchema)
            .set({
                institutionId: account.institutionId,
                name: account.name,
                category: account.category,
                group: account.group,
                type: account.type,
                isHidden: account.isHidden,
                isManual: account.isManual,
                isRetirement: account.isRetirement,
                hideFromCashflow: account.hideFromCashflow,
                updatedAt: DateTimeUtil.now()
            })
            .where((eq(accountSchema.id, account.id)))
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
        const result = await this.db.delete(accountSchema)
            .where((eq(accountSchema.id, id)))
            .returning({ id: accountSchema.id });

        return result.length > 0;
    }
}