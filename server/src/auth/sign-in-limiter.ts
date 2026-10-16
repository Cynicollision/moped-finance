import { DateTimeUtil } from '@server/utility';

/** How many failed sign-ins an address gets, within how long, and how long it's then refused (AUTH-10.1). */
export interface SignInLimits {
    maxFailedAttempts: number;
    windowMinutes: number;
    lockoutMinutes: number;
}

export const DEFAULT_SIGN_IN_LIMITS: SignInLimits = { maxFailedAttempts: 5, windowMinutes: 15, lockoutMinutes: 15 };

// The optional environment variables that change the limits, and their allowed ranges (AUTH-10.7).
const limitVariables: { name: string; limit: keyof SignInLimits; min: number; max: number }[] = [
    { name: 'SIGN_IN_MAX_FAILED_ATTEMPTS', limit: 'maxFailedAttempts', min: 3, max: 10 },
    { name: 'SIGN_IN_WINDOW_MINUTES', limit: 'windowMinutes', min: 5, max: 60 },
    { name: 'SIGN_IN_LOCKOUT_MINUTES', limit: 'lockoutMinutes', min: 5, max: 60 }
];

const minuteMs = 60_000;

// Above this many addresses, recording a failure first forgets the ones with nothing left to remember.
const sweepThreshold = 1000;

/**
 * Counts failed sign-ins per network address and refuses an address that has too many (AUTH-10), rather than locking
 * the account, so someone else on the network can't lock the owner out. Kept in memory: there's one server process,
 * and a restart clears every lockout.
 */
export class SignInLimiter {
    // Each address's failed sign-ins still inside the window, oldest first.
    private readonly failures = new Map<string, Date[]>();
    // When each locked-out address may try again.
    private readonly lockedUntil = new Map<string, Date>();

    constructor(public readonly limits: SignInLimits = DEFAULT_SIGN_IN_LIMITS) {}

    /**
     * The limits, with any set in the environment in place of the defaults (AUTH-10.7). Throws, naming the variable,
     * for a value that isn't a whole number in its range, so the server refuses to start.
     */
    public static limitsFromEnvironment(env: NodeJS.ProcessEnv): SignInLimits {
        const limits = { ...DEFAULT_SIGN_IN_LIMITS };
        for (const { name, limit, min, max } of limitVariables) {
            const text = env[name]?.trim();
            if (!text) {
                continue;
            }
            const value = Number(text);
            if (!/^\d+$/.test(text) || value < min || value > max) {
                throw new Error(`${name} must be a whole number from ${min} to ${max}, not '${text}'.`);
            }
            limits[limit] = value;
        }
        return limits;
    }

    /** Whole minutes, rounded up, until the address may sign in again; 0 if it isn't locked out. */
    public minutesLockedOut(address: string): number {
        const until = this.lockedUntil.get(address);
        if (!until) {
            return 0;
        }
        const remainingMs = until.getTime() - DateTimeUtil.now().getTime();
        if (remainingMs <= 0) {
            this.lockedUntil.delete(address);
            return 0;
        }
        return Math.ceil(remainingMs / minuteMs);
    }

    /** Counts a failed sign-in. True when it's the one that locks the address out. */
    public recordFailure(address: string): boolean {
        if (this.failures.size >= sweepThreshold) {
            this.sweep();
        }

        const now = DateTimeUtil.now();
        const recent = [...this.withinWindow(address, now), now];
        if (recent.length < this.limits.maxFailedAttempts) {
            this.failures.set(address, recent);
            return false;
        }

        this.failures.delete(address);
        this.lockedUntil.set(address, DateTimeUtil.addMilliseconds(now, this.limits.lockoutMinutes * minuteMs));
        return true;
    }

    /** A successful sign-in starts the address's count again (AUTH-10.3). */
    public recordSuccess(address: string): void {
        this.failures.delete(address);
    }

    private withinWindow(address: string, now: Date): Date[] {
        const windowStart = now.getTime() - this.limits.windowMinutes * minuteMs;
        return (this.failures.get(address) ?? []).filter(time => time.getTime() > windowStart);
    }

    private sweep(): void {
        const now = DateTimeUtil.now();
        for (const address of [...this.failures.keys()]) {
            if (this.withinWindow(address, now).length === 0) {
                this.failures.delete(address);
            }
        }
        for (const [address, until] of [...this.lockedUntil]) {
            if (until <= now) {
                this.lockedUntil.delete(address);
            }
        }
    }
}
