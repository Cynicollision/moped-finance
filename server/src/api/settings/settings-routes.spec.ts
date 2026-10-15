import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { SettingsData } from './settings-data';
import { createSettingsRouter } from './settings-routes';

describe('Settings Routes', () => {
    let app: express.Express;
    let pglite: PGlite;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        pglite = mockDb.pglite;

        const router = createSettingsRouter(TestExpressUtil.createMockLogger(), new SettingsData(mockDb.dbClient));
        app = TestExpressUtil.createTestApp(router, '/settings');
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearCoreData(pglite);
    });

    describe('GET /settings', () => {
        it('SET-1.2 should return the defaults before anything is saved', async () => {
            const response = await request(app).get('/settings');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ showRetirementGroup: true });
        });

        it('SET-1.2 should use the default for a stored value that no longer fits, and ignore unknown settings', async () => {
            await pglite.exec(`
                INSERT INTO core.settings (key, value) VALUES
                    ('showRetirementGroup', '"no"'),
                    ('removedSetting', 'true');
            `);

            const response = await request(app).get('/settings');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ showRetirementGroup: true });
        });
    });

    describe('PUT /settings', () => {
        it('SET-5.1 SET-1.2 should save a setting and return it from then on', async () => {
            const response = await request(app).put('/settings').send({ showRetirementGroup: false });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ showRetirementGroup: false });
            expect((await request(app).get('/settings')).body).toEqual({ showRetirementGroup: false });
        });

        it('SET-1.2 should store one row per setting, and update it in place', async () => {
            await request(app).put('/settings').send({ showRetirementGroup: false });
            await request(app).put('/settings').send({ showRetirementGroup: true });

            const rows = await pglite.query<{ key: string; value: unknown }>('SELECT key, value FROM core.settings');
            expect(rows.rows).toEqual([{ key: 'showRetirementGroup', value: true }]);
        });

        it('SET-1.2 should not store settings it does not know', async () => {
            await request(app).put('/settings').send({ unknownSetting: 1 });

            const rows = await pglite.query('SELECT key FROM core.settings');
            expect(rows.rows).toEqual([]);
        });

        it('SET-1.2 should keep settings that are not sent', async () => {
            await request(app).put('/settings').send({ showRetirementGroup: false });

            const response = await request(app).put('/settings').send({});

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ showRetirementGroup: false });
        });

        it('SET-1.2 should refuse a value of the wrong type', async () => {
            const response = await request(app).put('/settings').send({ showRetirementGroup: 'no' });

            expect(response.status).toBe(400);
        });
    });
});
