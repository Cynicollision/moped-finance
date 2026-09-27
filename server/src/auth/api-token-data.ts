import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { check, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ApiTokenAccess } from '@shared/core/enum';
import { ApiToken, User } from '@shared/core/types';
import { coreSchema, IDatabaseClient, SchemaUtil } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { userSchema } from './user-data';

// Personal API tokens (AUTH-11). Only a SHA-256 hash of each token is stored.
export const apiTokenSchema = coreSchema.table('api_tokens', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull().references(() => userSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    access: varchar('access', { length: 20 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true })
}, (table) => [
    uniqueIndex('api_tokens_token_hash_unique_idx').on(table.tokenHash),
    check('api_tokens_access_check', SchemaUtil.isOneOf(table.access, Object.values(ApiTokenAccess)))
]);

export type NewApiToken = ApiToken & { userId: string, tokenHash: string };

/** A valid token's owner and access, for authenticating a request. */
export type ApiTokenGrant = { tokenId: string, access: ApiTokenAccess, user: User };

// Last used is accurate to the minute (AUTH-11.10), so a script making many calls doesn't write on every one.
const LAST_USED_RESOLUTION_MS = 60 * 1000;

export interface IApiTokenData {
    insert(token: NewApiToken): Promise<ApiToken>;
    retrieveAll(): Promise<ApiToken[]>;
    retrieveValidByHash(tokenHash: string): Promise<ApiTokenGrant | null>;
    recordUse(id: string): Promise<void>;
    delete(id: string): Promise<boolean>;
}

export class ApiTokenData implements IApiTokenData {
    private db: NodePgDatabase;

    private readonly columns = {
        id: apiTokenSchema.id,
        createdAt: apiTokenSchema.createdAt,
        name: apiTokenSchema.name,
        access: apiTokenSchema.access,
        lastUsedAt: apiTokenSchema.lastUsedAt,
        expiresAt: apiTokenSchema.expiresAt
    };

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async insert(token: NewApiToken): Promise<ApiToken> {
        const rows = await this.db.insert(apiTokenSchema)
            .values(token)
            .returning(this.columns);

        return rows[0] as ApiToken;
    }

    /** Every token, newest first. */
    public async retrieveAll(): Promise<ApiToken[]> {
        const rows = await this.db.select(this.columns)
            .from(apiTokenSchema)
            .orderBy(desc(apiTokenSchema.createdAt));

        return rows as ApiToken[];
    }

    /** The token with this hash and its owner, unless it doesn't exist or has expired. */
    public async retrieveValidByHash(tokenHash: string): Promise<ApiTokenGrant | null> {
        const rows = await this.db
            .select({
                tokenId: apiTokenSchema.id,
                access: apiTokenSchema.access,
                user: {
                    id: userSchema.id,
                    createdAt: userSchema.createdAt,
                    updatedAt: userSchema.updatedAt,
                    username: userSchema.username,
                    displayName: userSchema.displayName
                }
            })
            .from(apiTokenSchema)
            .innerJoin(userSchema, eq(apiTokenSchema.userId, userSchema.id))
            .where(and(
                eq(apiTokenSchema.tokenHash, tokenHash),
                or(isNull(apiTokenSchema.expiresAt), gt(apiTokenSchema.expiresAt, DateTimeUtil.now()))
            ));

        return rows.length > 0 ? rows[0] as ApiTokenGrant : null;
    }

    public async recordUse(id: string): Promise<void> {
        const now = DateTimeUtil.now();
        const staleBefore = DateTimeUtil.addMilliseconds(now, -LAST_USED_RESOLUTION_MS);

        await this.db.update(apiTokenSchema)
            .set({ lastUsedAt: now })
            .where(and(
                eq(apiTokenSchema.id, id),
                or(isNull(apiTokenSchema.lastUsedAt), lt(apiTokenSchema.lastUsedAt, staleBefore))
            ));
    }

    public async delete(id: string): Promise<boolean> {
        const rows = await this.db.delete(apiTokenSchema)
            .where(eq(apiTokenSchema.id, id))
            .returning({ id: apiTokenSchema.id });

        return rows.length > 0;
    }
}
