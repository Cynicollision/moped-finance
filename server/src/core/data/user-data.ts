import { eq } from 'drizzle-orm';
import { pgSchema, varchar, timestamp } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { User } from '@shared/core/types/user';
import { IDatabaseClient } from '@server-core/db-client';
import { DateTimeUtil } from '@server-core/utility';

const coreSchema = pgSchema('core');

const userSchema = coreSchema.table('users', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    username: varchar('username', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull()
});

export interface UserWithPassword extends User {
    passwordHash: string;
}

export interface ICoreUserData {
    create(user: User, passwordHash: string): Promise<User>;
    retrieveSingle(id: string): Promise<User | null>;
    retrieveByUsername(username: string): Promise<UserWithPassword | null>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
}

export class CoreUserData implements ICoreUserData {
    private db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async create(user: User, passwordHash: string): Promise<User> {
        const rows = await this.db.insert(userSchema)
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

        return rows[0] as User;
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
        const rows = await this.db.update(userSchema)
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
}
