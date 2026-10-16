import { count, eq, sql } from 'drizzle-orm';
import { varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { User } from '@shared/core/types/user';
import { coreSchema, DbTransaction, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';

export const userSchema = coreSchema.table(
    'users',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        username: varchar('username', { length: 255 }).notNull().unique(),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        displayName: varchar('display_name', { length: 255 }).notNull()
    },
    () => [
        // One user per instance (AUTH-7.2): every row indexes the same value, so a second user is a unique violation,
        // even from two registrations that both found no user at the same moment (AUTH-2.7).
        uniqueIndex('users_single_user_idx').on(sql`(true)`)
    ]
);

export interface UserWithPassword extends User {
    passwordHash: string;
}

export interface IUserData {
    /** Inserts the user, then runs `setUp` in the same transaction, so either both are saved or neither is. */
    create(user: User, passwordHash: string, setUp?: (tx: DbTransaction) => Promise<void>): Promise<User>;
    retrieveSingle(id: string): Promise<User | null>;
    retrieveByUsername(username: string): Promise<UserWithPassword | null>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
    /** The updated user, or null if there's no user with that ID. */
    updateDisplayName(id: string, displayName: string): Promise<User | null>;
    retrieveCount(): Promise<number>;
}

export class UserData implements IUserData {
    private db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async create(user: User, passwordHash: string, setUp?: (tx: DbTransaction) => Promise<void>): Promise<User> {
        return this.db.transaction(async tx => {
            const rows = await tx
                .insert(userSchema)
                .values({
                    id: user.id,
                    username: user.username,
                    passwordHash: passwordHash,
                    displayName: user.displayName
                })
                .returning({
                    id: userSchema.id,
                    createdAt: userSchema.createdAt,
                    updatedAt: userSchema.updatedAt,
                    username: userSchema.username,
                    displayName: userSchema.displayName
                });

            await setUp?.(tx);
            return rows[0] as User;
        });
    }

    public async retrieveSingle(id: string): Promise<User | null> {
        const rows = await this.db
            .select({
                id: userSchema.id,
                createdAt: userSchema.createdAt,
                updatedAt: userSchema.updatedAt,
                username: userSchema.username,
                displayName: userSchema.displayName
            })
            .from(userSchema)
            .where(eq(userSchema.id, id));

        if (rows.length > 0) {
            return rows[0] as User;
        }
        return null;
    }

    public async retrieveByUsername(username: string): Promise<UserWithPassword | null> {
        const rows = await this.db
            .select({
                id: userSchema.id,
                createdAt: userSchema.createdAt,
                updatedAt: userSchema.updatedAt,
                username: userSchema.username,
                passwordHash: userSchema.passwordHash,
                displayName: userSchema.displayName
            })
            .from(userSchema)
            .where(eq(userSchema.username, username));

        if (rows.length > 0) {
            return rows[0] as UserWithPassword;
        }
        return null;
    }

    public async updatePassword(id: string, passwordHash: string): Promise<void> {
        const rows = await this.db
            .update(userSchema)
            .set({
                passwordHash: passwordHash,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(userSchema.id, id))
            .returning({ id: userSchema.id });

        if (rows.length === 0) {
            throw new Error('User not found.');
        }
    }

    public async updateDisplayName(id: string, displayName: string): Promise<User | null> {
        const rows = await this.db
            .update(userSchema)
            .set({
                displayName,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(userSchema.id, id))
            .returning({
                id: userSchema.id,
                createdAt: userSchema.createdAt,
                updatedAt: userSchema.updatedAt,
                username: userSchema.username,
                displayName: userSchema.displayName
            });

        return rows.length > 0 ? (rows[0] as User) : null;
    }

    public async retrieveCount(): Promise<number> {
        const rows = await this.db.select({ count: count() }).from(userSchema);
        return rows[0].count;
    }
}
