import { DateTimeUtil } from './date-time-util';

describe('DateTimeUtil', () => {
    it('APP-5.6 should work out today in the time zone set by TZ', () => {
        // Tests run with TZ=America/New_York (jest.config.js), where 02:00 UTC on May 1 is still April 30.
        DateTimeUtil.setClock(new Date('2026-05-01T02:00:00Z'));

        expect(DateTimeUtil.today()).toBe('2026-04-30');
    });

    it('should return a copy of a fixed time, so callers cannot move the clock', () => {
        DateTimeUtil.setClock(new Date('2026-05-01T12:00:00Z'));
        DateTimeUtil.now().setFullYear(2000);

        expect(DateTimeUtil.getCurrentTimestamp()).toBe('2026-05-01T12:00:00.000Z');
    });

    it('should follow a clock function, and go back to the real time when reset', () => {
        let time = new Date('2026-05-01T12:00:00Z');
        DateTimeUtil.setClock(() => time);
        time = new Date('2026-05-02T12:00:00Z');

        expect(DateTimeUtil.today()).toBe('2026-05-02');

        DateTimeUtil.resetClock();
        expect(Math.abs(DateTimeUtil.now().getTime() - Date.now())).toBeLessThan(1000);
    });
});
