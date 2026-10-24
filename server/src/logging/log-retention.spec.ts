import { PGlite } from '@electric-sql/pglite';
import { LogLevel } from '@shared/core/enum';
import { DatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { TestDatabaseUtil } from '@server/utility/testing';
import { ILogData, LogData } from './log-data';
import { DEFAULT_LOG_RETENTION_DAYS, LogRetention } from './log-retention';

describe('LogRetention', () => {
    describe('retentionDaysFromEnvironment', () => {
        it('APP-5.10 should keep 90 days when LOG_RETENTION_DAYS is not set', () => {
            expect(LogRetention.retentionDaysFromEnvironment({})).toBe(90);
            expect(LogRetention.retentionDaysFromEnvironment({ LOG_RETENTION_DAYS: '  ' })).toBe(
                DEFAULT_LOG_RETENTION_DAYS
            );
        });

        it('APP-5.10 should read LOG_RETENTION_DAYS', () => {
            expect(LogRetention.retentionDaysFromEnvironment({ LOG_RETENTION_DAYS: '7' })).toBe(7);
            expect(LogRetention.retentionDaysFromEnvironment({ LOG_RETENTION_DAYS: '3650' })).toBe(3650);
        });

        it.each(['6', '3651', '30.5', '-30', 'forever'])('APP-5.10 should refuse LOG_RETENTION_DAYS=%s', text => {
            expect(() => LogRetention.retentionDaysFromEnvironment({ LOG_RETENTION_DAYS: text })).toThrow(
                `LOG_RETENTION_DAYS must be a whole number from 7 to 3650, not '${text}'.`
            );
        });
    });

    describe('prune', () => {
        let dbClient: DatabaseClient;
        let pglite: PGlite;
        let logData: LogData;

        beforeAll(async () => {
            ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
            logData = new LogData(dbClient);
        });

        afterAll(async () => {
            await TestDatabaseUtil.destroyMockDatabase(pglite);
        });

        afterEach(async () => {
            DateTimeUtil.resetClock();
            jest.restoreAllMocks();
            await pglite.exec('DELETE FROM core.logs;');
        });

        async function addLog(id: string, createdAt: string): Promise<void> {
            await pglite.query(
                `INSERT INTO core.logs (id, created_at, user_id, level, context, message) VALUES ($1, $2, 'user-1', $3, '', 'Something failed')`,
                [id, createdAt, LogLevel.ERROR]
            );
        }

        it('APP-5.10 should delete log entries older than the retention period and keep the rest', async () => {
            DateTimeUtil.setClock(new Date('2026-10-24T12:00:00Z'));
            await addLog('old', '2026-07-26T11:59:59Z');
            await addLog('cutoff', '2026-07-26T12:00:00Z');
            await addLog('recent', '2026-10-24T11:00:00Z');
            jest.spyOn(console, 'info').mockImplementation(() => undefined);

            const deleted = await new LogRetention(logData, 90).prune();

            expect(deleted).toBe(1);
            const remaining = await pglite.query<{ id: string }>('SELECT id FROM core.logs ORDER BY id');
            expect(remaining.rows.map(row => row.id)).toEqual(['cutoff', 'recent']);
            expect(console.info).toHaveBeenCalledWith(
                expect.stringContaining('Deleted 1 log entries older than 90 days.')
            );
        });

        it('APP-5.1 APP-5.10 should not reject when deleting fails', async () => {
            const failing: ILogData = {
                create: jest.fn(),
                deleteOlderThan: jest.fn().mockRejectedValue(new Error('connection terminated'))
            };
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            await expect(new LogRetention(failing).prune()).resolves.toBe(0);

            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete old log entries: connection terminated')
            );
        });
    });
});
