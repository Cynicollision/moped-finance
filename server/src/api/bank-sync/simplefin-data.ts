import { randomInt } from 'crypto';
import { and, asc, desc, eq, gt, isNotNull, isNull, ne, notExists, notInArray, or, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';
import { BankAccountLinkStatus, BankSyncPauseReason, SyncRunStatus, SyncTrigger } from '@shared/finance/enum';
import { BankAccount, SyncRun } from '@shared/finance/types';
import { DbTransaction, EntityId, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './../accounts/account-schema';
import { applyPayload } from './bank-account-link-data';
import {
    simplefinAccessSchema,
    simplefinAccountSchema,
    simplefinConnectionSchema,
    syncRunSchema
} from './simplefin-schema';
import { SimplefinAccount, SimplefinAccountSet, SimplefinMessage } from './simplefin-response';

/** The stored connection to the SimpleFIN server. `accessUrl` is still sealed. */
export interface SimplefinAccess {
    sealedAccessUrl: string;
    claimedAt: Date;
    scheduleMinute: number;
    pausedReason: BankSyncPauseReason | null;
}

/** How a run ended. */
export interface SyncRunResult {
    status: SyncRunStatus.Succeeded | SyncRunStatus.Failed | SyncRunStatus.Skipped;
    failure?: string;
    messages?: SimplefinMessage[];
    response?: SimplefinAccountSet;
    accountsUpdated?: number;
    transactionsAdded?: number;
    transactionsUpdated?: number;
}

export interface ISimplefinData {
    retrieveAccess(): Promise<SimplefinAccess | null>;
    /**
     * Stores a newly claimed access URL (sealed), unpausing syncing. Connecting again (SYNC-1.3) keeps the schedule
     * and the bank accounts with their links; a first connection gets a random schedule minute (SYNC-3.1).
     */
    saveAccess(sealedAccessUrl: string, claimedAt: Date): Promise<void>;
    setPausedReason(reason: BankSyncPauseReason | null): Promise<void>;
    /**
     * Deletes the access URL, the connections and bank accounts, and every run's payload (SYNC-1.4), together or not
     * at all. Runs keep their times, so SYNC-3.4's limit still counts their requests. False when not connected.
     */
    disconnect(): Promise<boolean>;

    /** Starts a run, or returns null when one is already running (SYNC-3.5). */
    startRun(trigger: SyncTrigger): Promise<SyncRun | null>;
    /** Records that the run's request to Bridge is about to go out (SYNC-3.4). */
    markRequested(runId: string): Promise<void>;
    finishRun(runId: string, result: SyncRunResult): Promise<SyncRun>;
    /** For a manual sync refused for the limit: it never asked Bridge, so it isn't kept. */
    deleteRun(runId: string): Promise<void>;
    /** Fails the runs a stopped server left running, so the lock is free again. Returns how many. */
    failInterruptedRuns(): Promise<number>;
    isRunning(): Promise<boolean>;
    /** When each request to Bridge after `since` went out, oldest first (SYNC-3.4). */
    requestTimesSince(since: Date): Promise<Date[]>;
    /** The latest runs, newest first. */
    retrieveRuns(limit: number): Promise<SyncRun[]>;
    /** The latest run that has finished. */
    retrieveLastFinishedRun(): Promise<SyncRun | null>;

    /**
     * Saves what a sync returned and finishes its run as succeeded, all in one database transaction or nothing
     * (SYNC-4.8): brings the connections and bank accounts up to date, writes each linked account's transactions and
     * balance (SYNC-4.1 to 4.5), unpauses syncing if `unpause`, and stores the payload and counts on the run. New bank
     * accounts arrive Not set up. One that isn't returned is marked missing (SYNC-2.9) if it's linked or ignored, and
     * otherwise removed, with any connection left without bank accounts.
     */
    completeRun(runId: string, accountSet: SimplefinAccountSet, unpause: boolean): Promise<SyncRun>;
    /** Every bank account, with its connection and link (SYNC-2.1). */
    retrieveBankAccounts(): Promise<BankAccount[]>;
    retrieveBankAccount(id: string): Promise<BankAccount | null>;
}

const runColumns = {
    id: syncRunSchema.id,
    trigger: syncRunSchema.trigger,
    status: syncRunSchema.status,
    startedAt: syncRunSchema.startedAt,
    finishedAt: syncRunSchema.finishedAt,
    accountsUpdated: syncRunSchema.accountsUpdated,
    transactionsAdded: syncRunSchema.transactionsAdded,
    transactionsUpdated: syncRunSchema.transactionsUpdated,
    failure: syncRunSchema.failure,
    messages: syncRunSchema.messages
};

type RunRow = Pick<typeof syncRunSchema.$inferSelect, keyof typeof runColumns>;

function mapRowToRun(row: RunRow): SyncRun {
    return {
        id: row.id,
        trigger: row.trigger as SyncTrigger,
        status: row.status as SyncRunStatus,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        accountsUpdated: row.accountsUpdated,
        transactionsAdded: row.transactionsAdded,
        transactionsUpdated: row.transactionsUpdated,
        failure: row.failure,
        messages: row.messages.map(message => ({
            code: message.code,
            text: message.text,
            connectionId: message.connectionId,
            accountId: message.accountId
        }))
    };
}

/** Only US dollar accounts can be linked (SYNC-2.6). */
const linkableCurrency = 'USD';

const fromUnixSeconds = (seconds: number) => new Date(seconds * 1000);

async function finishRunIn(db: NodePgDatabase | DbTransaction, runId: string, result: SyncRunResult) {
    const rows = await db
        .update(syncRunSchema)
        .set({
            status: result.status,
            finishedAt: DateTimeUtil.now(),
            failure: result.failure ?? null,
            messages: result.messages ?? [],
            response: result.response ?? null,
            accountsUpdated: result.accountsUpdated ?? 0,
            transactionsAdded: result.transactionsAdded ?? 0,
            transactionsUpdated: result.transactionsUpdated ?? 0
        })
        .where(eq(syncRunSchema.id, runId))
        .returning(runColumns);

    return mapRowToRun(rows[0]);
}

export class SimplefinData implements ISimplefinData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAccess(): Promise<SimplefinAccess | null> {
        const rows = await this.db.select().from(simplefinAccessSchema);
        if (rows.length === 0) {
            return null;
        }
        const row = rows[0];
        return {
            sealedAccessUrl: row.accessUrl,
            claimedAt: row.claimedAt,
            scheduleMinute: row.scheduleMinute,
            pausedReason: row.pausedReason as BankSyncPauseReason | null
        };
    }

    public async saveAccess(sealedAccessUrl: string, claimedAt: Date): Promise<void> {
        await this.db.transaction(async tx => {
            const updated = await tx
                .update(simplefinAccessSchema)
                .set({ accessUrl: sealedAccessUrl, claimedAt, pausedReason: null })
                .returning({ id: simplefinAccessSchema.id });
            if (updated.length === 0) {
                await tx.insert(simplefinAccessSchema).values({
                    id: EntityId.generate(),
                    accessUrl: sealedAccessUrl,
                    claimedAt,
                    // 6 hours apart, so the first of the day is in the first 6 hours (SYNC-3.1).
                    scheduleMinute: randomInt(0, 360),
                    pausedReason: null
                });
            }
        });
    }

    public async setPausedReason(reason: BankSyncPauseReason | null): Promise<void> {
        await this.db.update(simplefinAccessSchema).set({ pausedReason: reason });
    }

    public async disconnect(): Promise<boolean> {
        return await this.db.transaction(async tx => {
            const deleted = await tx.delete(simplefinAccessSchema).returning({ id: simplefinAccessSchema.id });
            // The bank accounts go with their connections.
            await tx.delete(simplefinConnectionSchema);
            await tx.update(syncRunSchema).set({ response: null }).where(isNotNull(syncRunSchema.response));
            return deleted.length > 0;
        });
    }

    public async startRun(trigger: SyncTrigger): Promise<SyncRun | null> {
        // The partial unique index on running runs is the lock: a second one conflicts and isn't inserted.
        const rows = await this.db
            .insert(syncRunSchema)
            .values({
                id: EntityId.generate(),
                trigger,
                status: SyncRunStatus.Running,
                startedAt: DateTimeUtil.now()
            })
            .onConflictDoNothing()
            .returning(runColumns);

        return rows.length > 0 ? mapRowToRun(rows[0]) : null;
    }

    public async markRequested(runId: string): Promise<void> {
        await this.db.update(syncRunSchema).set({ requestedAt: DateTimeUtil.now() }).where(eq(syncRunSchema.id, runId));
    }

    public async finishRun(runId: string, result: SyncRunResult): Promise<SyncRun> {
        return finishRunIn(this.db, runId, result);
    }

    public async deleteRun(runId: string): Promise<void> {
        await this.db.delete(syncRunSchema).where(eq(syncRunSchema.id, runId));
    }

    public async failInterruptedRuns(): Promise<number> {
        const rows = await this.db
            .update(syncRunSchema)
            .set({
                status: SyncRunStatus.Failed,
                finishedAt: DateTimeUtil.now(),
                failure: 'The server stopped before this sync finished.'
            })
            .where(eq(syncRunSchema.status, SyncRunStatus.Running))
            .returning({ id: syncRunSchema.id });

        return rows.length;
    }

    public async isRunning(): Promise<boolean> {
        const rows = await this.db
            .select({ id: syncRunSchema.id })
            .from(syncRunSchema)
            .where(eq(syncRunSchema.status, SyncRunStatus.Running));

        return rows.length > 0;
    }

    public async requestTimesSince(since: Date): Promise<Date[]> {
        const rows = await this.db
            .select({ requestedAt: syncRunSchema.requestedAt })
            .from(syncRunSchema)
            .where(gt(syncRunSchema.requestedAt, since))
            .orderBy(asc(syncRunSchema.requestedAt));

        return rows.map(row => row.requestedAt!);
    }

    public async retrieveRuns(limit: number): Promise<SyncRun[]> {
        const rows = await this.db
            .select(runColumns)
            .from(syncRunSchema)
            .orderBy(desc(syncRunSchema.startedAt), desc(syncRunSchema.id))
            .limit(limit);

        return rows.map(mapRowToRun);
    }

    public async retrieveLastFinishedRun(): Promise<SyncRun | null> {
        const rows = await this.db
            .select(runColumns)
            .from(syncRunSchema)
            .where(ne(syncRunSchema.status, SyncRunStatus.Running))
            .orderBy(desc(syncRunSchema.startedAt), desc(syncRunSchema.id))
            .limit(1);

        return rows.length > 0 ? mapRowToRun(rows[0]) : null;
    }

    public async completeRun(runId: string, accountSet: SimplefinAccountSet, unpause: boolean): Promise<SyncRun> {
        const now = DateTimeUtil.now();

        return await this.db.transaction(async tx => {
            // Bridge's connection ID to ours.
            const connectionIds = new Map<string, string>();
            for (const connection of accountSet.connections) {
                const rows = await tx
                    .insert(simplefinConnectionSchema)
                    .values({
                        id: EntityId.generate(),
                        simplefinId: connection.id,
                        name: connection.name,
                        orgId: connection.orgId,
                        orgUrl: connection.orgUrl
                    })
                    .onConflictDoUpdate({
                        target: simplefinConnectionSchema.simplefinId,
                        set: { name: connection.name, orgId: connection.orgId, orgUrl: connection.orgUrl }
                    })
                    .returning({ id: simplefinConnectionSchema.id });
                connectionIds.set(connection.id, rows[0].id);
            }

            // Our bank account ID to what the sync returned for it.
            const returned = new Map<string, SimplefinAccount>();
            for (const account of accountSet.accounts) {
                const connectionId = connectionIds.get(account.connectionId);
                if (!connectionId) {
                    // The parser gives every account its connection, so this would be Bridge contradicting itself.
                    continue;
                }
                const fields = {
                    name: account.name,
                    currency: account.currency,
                    balance: account.balance,
                    availableBalance: account.availableBalance,
                    balanceDate: fromUnixSeconds(account.balanceDate),
                    missingSince: null
                };
                const rows = await tx
                    .insert(simplefinAccountSchema)
                    .values({ id: EntityId.generate(), connectionId, simplefinId: account.id, ...fields })
                    .onConflictDoUpdate({
                        target: [simplefinAccountSchema.connectionId, simplefinAccountSchema.simplefinId],
                        set: fields
                    })
                    .returning({ id: simplefinAccountSchema.id });
                returned.set(rows[0].id, account);
            }

            const returnedIds = [...returned.keys()];
            const notReturned = returnedIds.length > 0 ? notInArray(simplefinAccountSchema.id, returnedIds) : undefined;
            const isSetUp = or(isNotNull(simplefinAccountSchema.linkedAccountId), simplefinAccountSchema.isIgnored);

            // Nothing to keep about a bank account that isn't set up; one that is keeps its choice (SYNC-2.9).
            await tx.delete(simplefinAccountSchema).where(and(notReturned, sql`NOT (${isSetUp})`));
            await tx
                .update(simplefinAccountSchema)
                .set({ missingSince: now })
                .where(and(notReturned, isNull(simplefinAccountSchema.missingSince)));
            await tx
                .delete(simplefinConnectionSchema)
                .where(
                    notExists(
                        tx
                            .select({ id: simplefinAccountSchema.id })
                            .from(simplefinAccountSchema)
                            .where(eq(simplefinAccountSchema.connectionId, simplefinConnectionSchema.id))
                    )
                );

            // Every linked bank account the sync returned writes into its account; a missing one waits (SYNC-2.9).
            const linked = await tx
                .select({
                    id: simplefinAccountSchema.id,
                    linkedAccountId: simplefinAccountSchema.linkedAccountId,
                    syncFrom: simplefinAccountSchema.syncFrom
                })
                .from(simplefinAccountSchema)
                .where(
                    and(
                        isNotNull(simplefinAccountSchema.linkedAccountId),
                        eq(simplefinAccountSchema.currency, linkableCurrency)
                    )
                );
            let accountsUpdated = 0;
            let transactionsAdded = 0;
            let transactionsUpdated = 0;
            for (const bankAccount of linked) {
                const payload = returned.get(bankAccount.id);
                if (!payload) {
                    continue;
                }
                const { added, updated } = await applyPayload(
                    tx,
                    bankAccount.id,
                    bankAccount.linkedAccountId!,
                    bankAccount.syncFrom,
                    payload
                );
                accountsUpdated++;
                transactionsAdded += added.length;
                transactionsUpdated += updated;
            }

            if (unpause) {
                await tx.update(simplefinAccessSchema).set({ pausedReason: null });
            }
            return await finishRunIn(tx, runId, {
                status: SyncRunStatus.Succeeded,
                messages: accountSet.messages,
                response: accountSet,
                accountsUpdated,
                transactionsAdded,
                transactionsUpdated
            });
        });
    }

    public async retrieveBankAccounts(): Promise<BankAccount[]> {
        return this.queryBankAccounts();
    }

    public async retrieveBankAccount(id: string): Promise<BankAccount | null> {
        const [bankAccount] = await this.queryBankAccounts(eq(simplefinAccountSchema.id, id));
        return bankAccount ?? null;
    }

    private async queryBankAccounts(where?: SQL): Promise<BankAccount[]> {
        // Both tables are called accounts, which Drizzle's join types can't tell apart without an alias.
        const linkedAccount = alias(accountSchema, 'linked_account');
        const rows = await this.db
            .select({
                account: {
                    id: simplefinAccountSchema.id,
                    connectionId: simplefinAccountSchema.connectionId,
                    name: simplefinAccountSchema.name,
                    currency: simplefinAccountSchema.currency,
                    balance: simplefinAccountSchema.balance,
                    availableBalance: simplefinAccountSchema.availableBalance,
                    balanceDate: simplefinAccountSchema.balanceDate,
                    missingSince: simplefinAccountSchema.missingSince,
                    isIgnored: simplefinAccountSchema.isIgnored,
                    linkedAccountId: simplefinAccountSchema.linkedAccountId,
                    syncFrom: simplefinAccountSchema.syncFrom
                },
                connectionName: simplefinConnectionSchema.name,
                linkedAccountName: linkedAccount.name
            })
            .from(simplefinAccountSchema)
            .innerJoin(simplefinConnectionSchema, eq(simplefinAccountSchema.connectionId, simplefinConnectionSchema.id))
            .leftJoin(linkedAccount, eq(simplefinAccountSchema.linkedAccountId, linkedAccount.id))
            .where(where)
            .orderBy(asc(simplefinConnectionSchema.name), asc(simplefinAccountSchema.name));

        // A bank account last synced with the latest successful sync that returned it: the latest of all, unless it's
        // missing since (SYNC-2.9).
        const succeeded = await this.db
            .select({ finishedAt: syncRunSchema.finishedAt })
            .from(syncRunSchema)
            .where(and(eq(syncRunSchema.status, SyncRunStatus.Succeeded), isNotNull(syncRunSchema.finishedAt)))
            .orderBy(desc(syncRunSchema.finishedAt));
        const lastSyncedBefore = (missingSince: Date | null) =>
            succeeded.find(run => !missingSince || run.finishedAt! < missingSince)?.finishedAt ?? null;

        return rows.map(({ account, connectionName, linkedAccountName }) => {
            const linkStatus = account.linkedAccountId
                ? BankAccountLinkStatus.Linked
                : account.isIgnored
                  ? BankAccountLinkStatus.Ignored
                  : BankAccountLinkStatus.NotSetUp;
            return {
                id: account.id,
                connectionId: account.connectionId,
                connectionName,
                name: account.name,
                currency: account.currency,
                canLink: account.currency === linkableCurrency,
                balance: Number(account.balance),
                availableBalance: account.availableBalance === null ? null : Number(account.availableBalance),
                balanceDate: account.balanceDate,
                linkStatus,
                linkedAccount:
                    account.linkedAccountId && linkedAccountName !== null
                        ? { id: account.linkedAccountId, name: linkedAccountName }
                        : null,
                missingSince: account.missingSince,
                lastSyncedAt: lastSyncedBefore(account.missingSince),
                syncFrom: account.linkedAccountId ? account.syncFrom : null
            };
        });
    }
}
