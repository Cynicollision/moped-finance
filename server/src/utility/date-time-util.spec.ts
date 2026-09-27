import { DateTimeUtil } from './date-time-util';

describe('DateTimeUtil', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('APP-5.6 should work out today in the time zone set by TZ', () => {
        // Tests run with TZ=America/New_York (jest.config.js), where 02:00 UTC on May 1 is still April 30.
        jest.useFakeTimers({ now: new Date('2026-05-01T02:00:00Z') });

        expect(DateTimeUtil.today()).toBe('2026-04-30');
    });
});
