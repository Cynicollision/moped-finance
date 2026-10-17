import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { DatabaseClient, EntityFactory } from '@server/data';
import { InstitutionData } from '@server/api/institutions/institution-data';
import { TestDatabaseUtil } from '@server/utility/testing';
import { SampleData } from './sample-data';

const dataDir = path.join(__dirname, './../../seed-data');

describe('SampleData', () => {
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let sampleData: SampleData;

    beforeAll(async () => {
        ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
        sampleData = new SampleData(dbClient, dataDir);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    async function dateRange(table: 'transactions' | 'balance_history'): Promise<{ first: string; last: string }> {
        const result = await dbClient.drizzle.execute<{ first: string; last: string }>(
            sql.raw(`SELECT min(date)::text AS first, max(date)::text AS last FROM finance.${table}`)
        );
        return result.rows[0];
    }

    it('should load every file with its dates as written', async () => {
        const saved = await sampleData.load();

        expect(saved).toEqual(
            expect.objectContaining({ institutions: 5, accounts: 10, categories: 26, categoryGroups: 8 })
        );
        expect(saved.transactions).toBeGreaterThan(1000);
        expect(saved.lastDate).toBe('2026-05-15');
        expect(await dateRange('transactions')).toEqual({ first: '2024-03-01', last: '2026-05-15' });
    });

    it('APP-10.4 should move the dates forward by whole months to end as close to the given date as it can', async () => {
        const saved = await sampleData.load({ endingBy: '2026-10-17' });

        expect(saved.lastDate).toBe('2026-10-15');
        expect(await dateRange('transactions')).toEqual({ first: '2024-08-01', last: '2026-10-15' });
        expect((await dateRange('balance_history')).last).toBe('2026-10-15');
    });

    it('APP-10.4 should stop a month short when a whole month would pass the given date', async () => {
        const saved = await sampleData.load({ endingBy: '2026-10-14' });

        expect(saved.lastDate).toBe('2026-09-15');
    });

    it('APP-10.4 should keep one balance per account and day when moving into a shorter month', async () => {
        // 2024-02-29 is the first balance date; three months on, May 29 / June 1 move into a 30-day month and the
        // 31-day months' last days clamp, so balances that were days apart can meet on one date.
        const saved = await sampleData.load({ endingBy: '2026-06-15' });

        expect(saved.lastDate).toBe('2026-06-15');
        const duplicates = await dbClient.drizzle.execute(sql`
            SELECT account_id, date FROM finance.balance_history GROUP BY account_id, date HAVING count(*) > 1
        `);
        expect(duplicates.rows).toEqual([]);
    });

    it('APP-10.3 should report whether the finance tables are empty', async () => {
        expect(await sampleData.isFinanceEmpty()).toBe(true);

        await new InstitutionData(dbClient).insert(EntityFactory.createInstitution({ name: 'Bank' }));

        expect(await sampleData.isFinanceEmpty()).toBe(false);
    });

    describe('monthsToMove', () => {
        it.each([
            ['2026-05-15', '2026-10-17', 5],
            ['2026-05-15', '2026-10-15', 5],
            ['2026-05-15', '2026-10-14', 4],
            ['2026-05-15', '2026-05-15', 0],
            ['2026-01-31', '2026-02-28', 1],
            ['2026-05-15', '2027-01-20', 8]
        ])('should move %s by whole months to end by %s: %i', (lastDate, endingBy, months) => {
            expect(SampleData.monthsToMove(lastDate, endingBy)).toBe(months);
        });
    });
});
