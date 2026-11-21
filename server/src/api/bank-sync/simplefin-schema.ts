import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    date,
    index,
    integer,
    jsonb,
    numeric,
    text,
    timestamp,
    unique,
    uniqueIndex,
    varchar
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { BankSyncPauseReason, SyncRunStatus, SyncTrigger } from '@shared/finance/enum';
import { SchemaUtil, simplefinSchema } from '@server/data';
import { accountSchema } from './../accounts/account-schema';
import { SimplefinAccountSet, SimplefinMessage } from './simplefin-response';

// The connection to SimpleFIN Bridge: at most one row (SYNC-1.1).
export const simplefinAccessSchema = simplefinSchema.table(
    'access',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        // Sealed with SecretBox (SYNC-1.2); never sent anywhere but Bridge.
        accessUrl: text('access_url').notNull(),
        claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull(),
        // The minute of the day, 0 to 359, of the first of the four daily syncs (SYNC-3.1).
        scheduleMinute: integer('schedule_minute').notNull(),
        pausedReason: varchar('paused_reason', { length: 20 })
    },
    table => [
        uniqueIndex('access_single_row_idx').on(sql`(true)`),
        check('access_schedule_minute_check', sql`${table.scheduleMinute} BETWEEN 0 AND 359`),
        check('access_paused_reason_check', SchemaUtil.isOneOf(table.pausedReason, Object.values(BankSyncPauseReason)))
    ]
);

// One sign-in at one bank, as Bridge returns them.
export const simplefinConnectionSchema = simplefinSchema.table(
    'connections',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        simplefinId: varchar('simplefin_id', { length: 255 }).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        orgId: varchar('org_id', { length: 255 }),
        orgUrl: varchar('org_url', { length: 500 })
    },
    table => [unique('connections_simplefin_id_unique').on(table.simplefinId)]
);

// One bank account, as the latest sync returned it, and what it syncs into (SYNC-2).
export const simplefinAccountSchema = simplefinSchema.table(
    'accounts',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        connectionId: varchar('connection_id', { length: 50 })
            .notNull()
            .references(() => simplefinConnectionSchema.id, { onDelete: 'cascade' }),
        // Unique within its connection only.
        simplefinId: varchar('simplefin_id', { length: 255 }).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        currency: varchar('currency', { length: 500 }).notNull(),
        balance: numeric('balance', { precision: 12, scale: 2, mode: 'number' }).notNull(),
        availableBalance: numeric('available_balance', { precision: 12, scale: 2, mode: 'number' }),
        balanceDate: timestamp('balance_date', { withTimezone: true }).notNull(),
        // When the first sync that didn't return it ran; null while syncs return it (SYNC-2.9).
        missingSince: timestamp('missing_since', { withTimezone: true }),
        // Don't sync (SYNC-2.2).
        isIgnored: boolean('is_ignored').notNull().default(false),
        // The account it syncs into (SYNC-2.4, SYNC-2.5), and the first day it takes transactions from.
        linkedAccountId: varchar('linked_account_id', { length: 50 }).references(() => accountSchema.id, {
            onDelete: 'set null'
        }),
        syncFrom: date('sync_from', { mode: 'string' })
    },
    table => [
        unique('accounts_connection_id_simplefin_id_unique').on(table.connectionId, table.simplefinId),
        unique('accounts_linked_account_id_unique').on(table.linkedAccountId)
    ]
);

// One sync (SYNC-3.7), and the requests to Bridge that SYNC-3.4's limit counts.
export const syncRunSchema = simplefinSchema.table(
    'sync_runs',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        trigger: varchar('trigger', { length: 20 }).notNull(),
        status: varchar('status', { length: 20 }).notNull(),
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        // Set just before the request to Bridge goes out, so a crash part way still counts it (SYNC-3.4).
        requestedAt: timestamp('requested_at', { withTimezone: true }),
        finishedAt: timestamp('finished_at', { withTimezone: true }),
        accountsUpdated: integer('accounts_updated').notNull().default(0),
        transactionsAdded: integer('transactions_added').notNull().default(0),
        transactionsUpdated: integer('transactions_updated').notNull().default(0),
        // Why it failed or was skipped, in our words: never a URL, token or response body.
        failure: text('failure'),
        // What Bridge said (SYNC-5.2).
        messages: jsonb('messages').$type<SimplefinMessage[]>().notNull().default([]),
        // The parsed payload of a successful request, for linking without asking Bridge again (SYNC-2.10).
        response: jsonb('response').$type<SimplefinAccountSet>()
    },
    table => [
        check('sync_runs_trigger_check', SchemaUtil.isOneOf(table.trigger, Object.values(SyncTrigger))),
        check('sync_runs_status_check', SchemaUtil.isOneOf(table.status, Object.values(SyncRunStatus))),
        // One sync at a time (SYNC-3.5): a second running row is a unique violation.
        uniqueIndex('sync_runs_one_running_idx')
            .on(table.status)
            .where(sql`${table.status} = 'running'`),
        index('sync_runs_started_at_idx').on(table.startedAt),
        index('sync_runs_requested_at_idx').on(table.requestedAt)
    ]
);

// SYNC-1.1
export const connectSchema = z.object({
    setupToken: z.string().trim().min(1).max(2000)
});

export type ConnectInput = z.output<typeof connectSchema>;
