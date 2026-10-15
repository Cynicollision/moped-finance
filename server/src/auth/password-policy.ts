import { DEFAULT_PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_RANGE, PasswordRules } from '@shared/core/util';

/** The password rules (AUTH-9.1) with this server's minimum length. */
export class PasswordPolicy {
    constructor(readonly minLength = DEFAULT_PASSWORD_MIN_LENGTH) {}

    /**
     * The policy from `PASSWORD_MIN_LENGTH`, or the default if it's empty or unset. Throws if it's set to anything
     * but a whole number in range, so the server refuses to start rather than run with rules nobody chose.
     */
    static fromEnvironment(value = process.env.PASSWORD_MIN_LENGTH): PasswordPolicy {
        if (value === undefined || value.trim() === '') {
            return new PasswordPolicy();
        }

        const { min, max } = PASSWORD_MIN_LENGTH_RANGE;
        const minLength = Number(value);
        if (!Number.isInteger(minLength) || minLength < min || minLength > max) {
            throw new Error(`PASSWORD_MIN_LENGTH must be a whole number from ${min} to ${max}; it's "${value}".`);
        }
        return new PasswordPolicy(minLength);
    }

    /** The messages for each rule `password` breaks; empty if it meets them all (AUTH-9.4). */
    problems(password: string, username: string): string[] {
        return PasswordRules.problems(password, username, this.minLength);
    }
}
