import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { User } from '@shared/core/types/user';
import { DatabaseClient } from '@server-core/db-client';

export class TestDatabaseUtil {
    public static async createMockDatabase(): Promise<{ dbClient: DatabaseClient, pglite: PGlite }> {
        const pglite = new PGlite();

        // Initialize schema
        const coreSqlPath = path.join(__dirname, '../../../../scripts/schema_core.sql');
        const coreSql = fs.readFileSync(coreSqlPath, 'utf8');
        await pglite.exec(coreSql);

        const financeSqlPath = path.join(__dirname, '../../../../scripts/schema_finance.sql');
        const financeSql = fs.readFileSync(financeSqlPath, 'utf8');
        await pglite.exec(financeSql);

        const memoryDrizzle = drizzle(pglite);
        const dbClient = new DatabaseClient(memoryDrizzle as any);

        return { dbClient, pglite };
    }

    public static async seedUser(dbClient: DatabaseClient, user: User, passwordHash: string): Promise<void> {
        await dbClient.drizzle.execute(sql`
            INSERT INTO core.users (id, username, password_hash, display_name) 
            VALUES (${user.id}, ${user.username}, ${passwordHash}, ${user.displayName})
        `);
    }

    public static async createTestUser(dbClient: DatabaseClient): Promise<User> {
        const user: User = { 
            id: '01testuser123456',
            createdAt: new Date(),
            updatedAt: new Date(),
            username: 'testuser', 
            displayName: 'Test User' 
        };
        await this.seedUser(dbClient, user, 'mock-hash');
        return user;
    }
}
