import { AppLogger, LogBehavior } from './logger';
import { ILogData } from './log-data';

describe('AppLogger', () => {
    it('APP-5.1 should not reject when writing a log entry to the database fails', async () => {
        const logData: ILogData = {
            create: jest.fn().mockRejectedValue(new Error('connection terminated')),
            deleteOlderThan: jest.fn()
        };
        const logger = new AppLogger(logData, {
            error: LogBehavior.Database,
            warn: LogBehavior.Ignore,
            info: LogBehavior.Ignore
        });
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const unhandled = jest.fn();
        process.on('unhandledRejection', unhandled);

        try {
            logger.error('user-1', 'Something failed');
            await new Promise(resolve => setImmediate(resolve));

            expect(logData.create).toHaveBeenCalledTimes(1);
            expect(unhandled).not.toHaveBeenCalled();
            // Once for the entry itself, once for the failed database write.
            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Something failed'));
            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('Failed to write log entry to the database: connection terminated')
            );
        } finally {
            process.off('unhandledRejection', unhandled);
        }
    });
});
