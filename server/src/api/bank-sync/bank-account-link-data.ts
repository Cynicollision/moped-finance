import { and, desc, eq, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';
import { CalendarDate } from '@shared/core/types';
import { SyncRunStatus } from '@shared/finance/enum';
import { Account, Institution } from '@shared/finance/types';
import { DbTransaction, EntityFactory, EntityId, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { accountSchema } from './../accounts/account-schema';
import { writeSetEntry } from './../accounts/balance-history-data';
import { balanceHistorySchema } from './../accounts/balance-history-schema';
import { institutionSchema } from './../institutions/institution-schema';
import { loadRuleEngine } from './../rules/rule-data';
import { RuleEngine } from './../rules/rule-engine';
import { mapTransactionToRow } from './../transactions/transaction-data';
import { transactionSchema } from './../transactions/transaction-schema';
import {
    simplefinAccountSchema,
    simplefinConnectionSchema,
    simplefinTransactionSchema,
    syncRunSchema
} from './simplefin-schema';
import { SimplefinAccount } from './simplefin-response';
import { SyncedTransaction, SyncTransform } from './sync-transform';

class AlreadyLinked extends Error {}

/** Postgres's bind-parameter limit allows far more, but this is the convention for multi-row writes. */
const chunkSize = 1000;

/** A new account for Create new account (SYNC-2.3), and the institution to create with it, if it's new. */
export interface NewLinkedAccount {
    account: Account;
    institution: Institution | null;
}

export interface IBankAccountLinkData {
    /**
     * The bank account as the latest successful sync returned it, with its transactions (SYNC-2.10), or null when
     * that sync didn't return it (SYNC-2.9) or there's been none.
     */
    retrieveLatestPayload(bankAccountId: string): Promise<SimplefinAccount | null>;
    /** The date of the account's latest transaction, or null when it has none (SYNC-2.4). */
    retrieveLatestTransactionDate(accountId: string): Promise<CalendarDate | null>;
    /** An institution whose name matches, ignoring case (SYNC-2.3). */
    retrieveInstitutionByName(name: string): Promise<Institution | null>;
    /**
     * Links the bank account to the account and adds its transactions from the payload (SYNC-2.4), all or nothing.
     * Returns how many it added, or null when the bank account is already linked (SYNC-2.5).
     */
    link(
        bankAccountId: string,
        accountId: string,
        syncFrom: CalendarDate,
        payload: SimplefinAccount | null
    ): Promise<number | null>;
    /** Creates the account (and institution) and links it in the same way (SYNC-2.3). */
    createAndLink(
        bankAccountId: string,
        created: NewLinkedAccount,
        syncFrom: CalendarDate,
        payload: SimplefinAccount | null
    ): Promise<number | null>;
    /** Don't sync (SYNC-2.2), unlinking it first if it's linked. False if there's no such bank account. */
    ignore(bankAccountId: string): Promise<boolean>;
    /** Back to Not set up (SYNC-2.7), keeping the account's history and what sync has seen. */
    unlink(bankAccountId: string): Promise<boolean>;
}

export class BankAccountLinkData implements IBankAccountLinkData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveLatestPayload(bankAccountId: string): Promise<SimplefinAccount | null> {
        const [bankAccount] = await this.db
            .select({
                simplefinId: simplefinAccountSchema.simplefinId,
                connectionSimplefinId: simplefinConnectionSchema.simplefinId
            })
            .from(simplefinAccountSchema)
            .innerJoin(simplefinConnectionSchema, eq(simplefinAccountSchema.connectionId, simplefinConnectionSchema.id))
            .where(eq(simplefinAccountSchema.id, bankAccountId));
        if (!bankAccount) {
            return null;
        }

        const [run] = await this.db
            .select({ response: syncRunSchema.response })
            .from(syncRunSchema)
            .where(and(eq(syncRunSchema.status, SyncRunStatus.Succeeded), isNotNull(syncRunSchema.response)))
            .orderBy(desc(syncRunSchema.startedAt), desc(syncRunSchema.id))
            .limit(1);

        return (
            run?.response?.accounts.find(
                account =>
                    account.id === bankAccount.simplefinId && account.connectionId === bankAccount.connectionSimplefinId
            ) ?? null
        );
    }

    public async retrieveLatestTransactionDate(accountId: string): Promise<CalendarDate | null> {
        const [row] = await this.db
            .select({ date: max(transactionSchema.date) })
            .from(transactionSchema)
            .where(eq(transactionSchema.accountId, accountId));
        return row?.date ?? null;
    }

    public async retrieveInstitutionByName(name: string): Promise<Institution | null> {
        const [row] = await this.db
            .select()
            .from(institutionSchema)
            .where(eq(sql`lower(${institutionSchema.name})`, name.toLowerCase()));
        return row ?? null;
    }

    public async link(
        bankAccountId: string,
        accountId: string,
        syncFrom: CalendarDate,
        payload: SimplefinAccount | null
    ): Promise<number | null> {
        return this.db.transaction(tx => linkInTransaction(tx, bankAccountId, accountId, syncFrom, payload));
    }

    public async createAndLink(
        bankAccountId: string,
        { account, institution }: NewLinkedAccount,
        syncFrom: CalendarDate,
        payload: SimplefinAccount | null
    ): Promise<number | null> {
        try {
            return await this.db.transaction(async tx => {
                if (institution) {
                    await tx.insert(institutionSchema).values({ id: institution.id, name: institution.name });
                }
                await tx.insert(accountSchema).values({
                    id: account.id,
                    institutionId: account.institutionId,
                    name: account.name,
                    type: account.type,
                    isHidden: account.isHidden
                });
                const added = await linkInTransaction(tx, bankAccountId, account.id, syncFrom, payload);
                if (added === null) {
                    // Linked while the request was on its way: the new account and institution aren't kept either.
                    throw new AlreadyLinked();
                }
                return added;
            });
        } catch (error) {
            if (error instanceof AlreadyLinked) {
                return null;
            }
            throw error;
        }
    }

    public async ignore(bankAccountId: string): Promise<boolean> {
        const rows = await this.db
            .update(simplefinAccountSchema)
            .set({ isIgnored: true, linkedAccountId: null, syncFrom: null })
            .where(eq(simplefinAccountSchema.id, bankAccountId))
            .returning({ id: simplefinAccountSchema.id });
        return rows.length > 0;
    }

    public async unlink(bankAccountId: string): Promise<boolean> {
        const rows = await this.db
            .update(simplefinAccountSchema)
            .set({ isIgnored: false, linkedAccountId: null, syncFrom: null })
            .where(eq(simplefinAccountSchema.id, bankAccountId))
            .returning({ id: simplefinAccountSchema.id });
        return rows.length > 0;
    }
}

/**
 * The link itself, in the caller's database transaction: sets it if the bank account isn't linked yet, turns off
 * Adjust balance on the account's transactions (ACCT-5.5), adds the payload's transactions from `syncFrom` (SYNC-4.1),
 * and records the bank's balance (ACCT-4.2), or for an account without balances fills in its history (SYNC-4.6).
 */
async function linkInTransaction(
    tx: DbTransaction,
    bankAccountId: string,
    accountId: string,
    syncFrom: CalendarDate,
    payload: SimplefinAccount | null
): Promise<number | null> {
    const linked = await tx
        .update(simplefinAccountSchema)
        .set({ linkedAccountId: accountId, syncFrom, isIgnored: false })
        .where(and(eq(simplefinAccountSchema.id, bankAccountId), isNull(simplefinAccountSchema.linkedAccountId)))
        .returning({ id: simplefinAccountSchema.id });
    if (linked.length === 0) {
        return null;
    }

    // Their balance entries stay as they are; only later edits stop moving the bank's balances.
    await tx
        .update(transactionSchema)
        .set({ adjustsBalance: false, updatedAt: DateTimeUtil.now() })
        .where(and(eq(transactionSchema.accountId, accountId), eq(transactionSchema.adjustsBalance, true)));

    if (!payload) {
        return 0;
    }
    const { added } = await applyPayload(tx, bankAccountId, accountId, syncFrom, payload, await loadRuleEngine(tx));
    return added.length;
}

/** What applying a bank account's transactions and balance did. */
export interface PayloadResult {
    /** The transactions it added. */
    added: SyncedTransaction[];
    /** How many transactions it changed with the bank's corrections (SYNC-4.4). */
    updated: number;
}

/**
 * Brings a linked account up to date with its bank account as a sync returned it, in the caller's database
 * transaction: adds the posted transactions from `syncFrom` it hasn't seen (SYNC-4.1), applies the bank's corrections
 * to those it has (SYNC-4.4), and records the bank's balance (ACCT-4.2), or for an account without balances fills in
 * its history (SYNC-4.6). Linking and every sync do this, with the rules loaded once in the same database transaction.
 */
export async function applyPayload(
    tx: DbTransaction,
    bankAccountId: string,
    accountId: string,
    syncFrom: CalendarDate | null,
    payload: SimplefinAccount,
    rules: RuleEngine
): Promise<PayloadResult> {
    const latestDate = DateTimeUtil.latestRecordDate();
    const synced = SyncTransform.transactions(payload, { from: syncFrom, to: latestDate });
    const result = await writeSyncedTransactions(tx, bankAccountId, accountId, synced, rules);

    const balanceDate = minDate(SyncTransform.toCalendarDate(payload.balanceDate), latestDate);
    const [entry] = await tx
        .select({ id: balanceHistorySchema.id })
        .from(balanceHistorySchema)
        .where(eq(balanceHistorySchema.accountId, accountId))
        .limit(1);
    const entries = entry
        ? [{ date: balanceDate, balance: payload.balance }]
        : SyncTransform.backfill(payload.balance, balanceDate, result.added);
    for (const balanceEntry of entries) {
        await writeSetEntry(tx, accountId, balanceEntry);
    }

    return result;
}

/** What `simplefin.transactions` knows about a bank transaction, and the transaction it became. */
interface SeenTransaction {
    /** Null once the user deleted it (TXN-2.12). */
    transactionId: string | null;
    accountId: string | null;
    isSplit: boolean;
    /** The bank's date, amount and description as last seen. */
    date: CalendarDate;
    amount: number;
    description: string;
}

/**
 * Writes a bank account's transactions into the account, recording each in `simplefin.transactions`:
 *
 * - One it hasn't seen is added, not adjusting the balance (SYNC-4.2), as the rules leave it (SYNC-4.3). So is
 *   one added to another account before the bank account was linked here, whose row moves to the new transaction.
 * - One the user deleted (a row without a transaction) is never added again (TXN-2.12).
 * - One already in this account whose date, amount or description the bank changed since it was last seen gets the
 *   change, unless it's split (SYNC-4.4). Its merchant, category, notes and Hide Transaction stay the user's.
 */
export async function writeSyncedTransactions(
    tx: DbTransaction,
    bankAccountId: string,
    accountId: string,
    synced: SyncedTransaction[],
    rules: RuleEngine
): Promise<PayloadResult> {
    const seen = await retrieveSeen(tx, bankAccountId, synced);

    const toAdd = synced.filter(t => {
        const known = seen.get(t.simplefinId);
        return !known || (known.transactionId !== null && known.accountId !== accountId);
    });

    // Rules categorize them and rename their merchants (SYNC-4.3, CAT-8.4); the rest are Uncategorized (CAT-5.5).
    const pairs = toAdd.map(t => ({
        synced: t,
        transaction: rules.apply(
            EntityFactory.createTransaction({
                accountId,
                categoryId: '',
                date: t.date,
                amount: t.amount,
                merchant: t.merchant,
                originalStatement: t.originalStatement,
                notes: '',
                isHidden: false
            }),
            { renameMerchant: true }
        )
    }));

    for (let i = 0; i < pairs.length; i += chunkSize) {
        const chunk = pairs.slice(i, i + chunkSize);
        await tx.insert(transactionSchema).values(chunk.map(p => mapTransactionToRow(p.transaction)));
        await tx
            .insert(simplefinTransactionSchema)
            .values(
                chunk.map(p => ({
                    id: EntityId.generate(),
                    simplefinAccountId: bankAccountId,
                    simplefinId: p.synced.simplefinId,
                    date: p.synced.date,
                    amount: p.synced.amount,
                    description: p.synced.originalStatement,
                    transactionId: p.transaction.id
                }))
            )
            .onConflictDoUpdate({
                target: [simplefinTransactionSchema.simplefinAccountId, simplefinTransactionSchema.simplefinId],
                set: {
                    date: sql`excluded.date`,
                    amount: sql`excluded.amount`,
                    description: sql`excluded.description`,
                    transactionId: sql`excluded.transaction_id`
                }
            });
    }

    // Banks correct few transactions, so these are written one at a time.
    const adding = new Set(toAdd.map(t => t.simplefinId));
    let updated = 0;
    for (const t of synced) {
        const known = seen.get(t.simplefinId);
        if (!known || adding.has(t.simplefinId) || !bankChanged(known, t)) {
            continue;
        }
        await tx
            .update(simplefinTransactionSchema)
            .set({ date: t.date, amount: t.amount, description: t.originalStatement })
            .where(
                and(
                    eq(simplefinTransactionSchema.simplefinAccountId, bankAccountId),
                    eq(simplefinTransactionSchema.simplefinId, t.simplefinId)
                )
            );
        // Deleted, or split into parts that are the user's (TXN-4.8): only the row remembers the bank's change.
        if (known.transactionId === null || known.isSplit) {
            continue;
        }
        await tx
            .update(transactionSchema)
            .set({
                date: t.date,
                amount: t.amount.toString(),
                originalStatement: t.originalStatement || null,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(transactionSchema.id, known.transactionId));
        updated++;
    }

    return { added: toAdd, updated };
}

/** What `simplefin.transactions` knows about these bank transactions, by the bank's ID. */
async function retrieveSeen(
    tx: DbTransaction,
    bankAccountId: string,
    synced: SyncedTransaction[]
): Promise<Map<string, SeenTransaction>> {
    // Both tables are called transactions, which Drizzle's join types can't tell apart without an alias.
    const added = alias(transactionSchema, 'added_transaction');
    const seen = new Map<string, SeenTransaction>();
    for (let i = 0; i < synced.length; i += chunkSize) {
        const ids = synced.slice(i, i + chunkSize).map(t => t.simplefinId);
        const rows = await tx
            .select({
                simplefinId: simplefinTransactionSchema.simplefinId,
                transactionId: simplefinTransactionSchema.transactionId,
                date: simplefinTransactionSchema.date,
                amount: simplefinTransactionSchema.amount,
                description: simplefinTransactionSchema.description,
                accountId: added.accountId,
                splitId: added.splitId
            })
            .from(simplefinTransactionSchema)
            .leftJoin(added, eq(simplefinTransactionSchema.transactionId, added.id))
            .where(
                and(
                    eq(simplefinTransactionSchema.simplefinAccountId, bankAccountId),
                    inArray(simplefinTransactionSchema.simplefinId, ids)
                )
            );
        for (const row of rows) {
            seen.set(row.simplefinId, {
                transactionId: row.transactionId,
                accountId: row.accountId,
                isSplit: row.splitId !== null,
                date: row.date,
                amount: Number(row.amount),
                description: row.description
            });
        }
    }
    return seen;
}

/** Whether the bank changed what it says about a transaction since it was last seen (SYNC-4.4). */
function bankChanged(known: SeenTransaction, t: SyncedTransaction): boolean {
    return (
        known.date !== t.date ||
        Math.round(known.amount * 100) !== Math.round(t.amount * 100) ||
        known.description !== t.originalStatement
    );
}

function minDate(a: CalendarDate, b: CalendarDate): CalendarDate {
    return a < b ? a : b;
}
