import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { User } from '@shared/core/types/user';
import { DatabaseClient } from '@server/data';

export class TestDatabaseUtil {
    public static async createMockDatabase(): Promise<{ dbClient: DatabaseClient, pglite: PGlite }> {
        const pglite = new PGlite();
        const memoryDrizzle = drizzle(pglite);

        // Same migrations the server applies on startup
        await migrate(memoryDrizzle, { migrationsFolder: path.join(__dirname, '../../../migrations') });

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

    public static async destroyMockDatabase(pglite: PGlite): Promise<void> {
        try {
            if (pglite && !pglite.closed) {
                // Allow pending operations to drain to prevent worker hangs in Jest
                await new Promise(resolve => setTimeout(resolve, 50));
                await pglite.close();
            }
        } catch (error) {
            console.error('Failed to close mock database:', error);
        }
    }

    public static async clearFinanceData(pglite: PGlite): Promise<void> {
        await pglite.exec('TRUNCATE finance.institutions, finance.accounts, finance.category_groups, finance.categories, finance.transactions, finance.budget_streams, finance.balance_history CASCADE;');
    }

    public static async clearCoreData(pglite: PGlite): Promise<void> {
        await pglite.exec('DELETE FROM core.users; DELETE FROM core.sessions; DELETE FROM core.secrets;');
    }
}
