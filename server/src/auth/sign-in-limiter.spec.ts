import { DateTimeUtil } from '@server/utility';
import { DEFAULT_SIGN_IN_LIMITS, SignInLimiter } from './sign-in-limiter';

describe('SignInLimiter', () => {
    describe('limitsFromEnvironment', () => {
        it('AUTH-10.1 AUTH-10.7 should use 5 attempts, a 15-minute window and a 15-minute lockout when nothing is set', () => {
            expect(SignInLimiter.limitsFromEnvironment({})).toEqual({
                maxFailedAttempts: 5,
                windowMinutes: 15,
                lockoutMinutes: 15
            });
            expect(SignInLimiter.limitsFromEnvironment({ SIGN_IN_WINDOW_MINUTES: '  ' })).toEqual(
                DEFAULT_SIGN_IN_LIMITS
            );
        });

        it('AUTH-10.7 should read each limit from the environment', () => {
            const limits = SignInLimiter.limitsFromEnvironment({
                SIGN_IN_MAX_FAILED_ATTEMPTS: '3',
                SIGN_IN_WINDOW_MINUTES: '60',
                SIGN_IN_LOCKOUT_MINUTES: '5'
            });

            expect(limits).toEqual({ maxFailedAttempts: 3, windowMinutes: 60, lockoutMinutes: 5 });
        });

        it.each([
            [
                'SIGN_IN_MAX_FAILED_ATTEMPTS',
                '2',
                "SIGN_IN_MAX_FAILED_ATTEMPTS must be a whole number from 3 to 10, not '2'."
            ],
            [
                'SIGN_IN_MAX_FAILED_ATTEMPTS',
                '11',
                "SIGN_IN_MAX_FAILED_ATTEMPTS must be a whole number from 3 to 10, not '11'."
            ],
            ['SIGN_IN_WINDOW_MINUTES', '4', "SIGN_IN_WINDOW_MINUTES must be a whole number from 5 to 60, not '4'."],
            ['SIGN_IN_LOCKOUT_MINUTES', '61', "SIGN_IN_LOCKOUT_MINUTES must be a whole number from 5 to 60, not '61'."],
            [
                'SIGN_IN_LOCKOUT_MINUTES',
                '7.5',
                "SIGN_IN_LOCKOUT_MINUTES must be a whole number from 5 to 60, not '7.5'."
            ],
            ['SIGN_IN_WINDOW_MINUTES', 'ten', "SIGN_IN_WINDOW_MINUTES must be a whole number from 5 to 60, not 'ten'."]
        ])('AUTH-10.7 should refuse %s=%s, naming it', (name, value, message) => {
            expect(() => SignInLimiter.limitsFromEnvironment({ [name]: value })).toThrow(message);
        });
    });

    describe('counting', () => {
        afterEach(() => {
            DateTimeUtil.resetClock();
        });

        it('AUTH-10.1 should report the lockout as the failure that starts it', () => {
            const limiter = new SignInLimiter();

            const results = [1, 2, 3, 4, 5].map(() => limiter.recordFailure('10.0.0.1'));

            expect(results).toEqual([false, false, false, false, true]);
            expect(limiter.minutesLockedOut('10.0.0.1')).toBe(15);
            expect(limiter.minutesLockedOut('10.0.0.2')).toBe(0);
        });

        it('AUTH-10.1 should forget addresses with nothing left to count once there are many', () => {
            DateTimeUtil.setClock(new Date('2026-10-16T12:00:00Z'));
            const limiter = new SignInLimiter();
            for (let i = 0; i < 1000; i++) {
                limiter.recordFailure(`10.0.${Math.floor(i / 256)}.${i % 256}`);
            }

            DateTimeUtil.setClock(new Date('2026-10-16T12:16:00Z'));
            limiter.recordFailure('10.9.9.9');

            expect((limiter as unknown as { failures: Map<string, Date[]> }).failures.size).toBe(1);
        });
    });
});
