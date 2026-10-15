/** The shortest password allowed (AUTH-9.1). */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt uses only the first 72 bytes of a password, so a longer one is refused rather than cut short. */
export const PASSWORD_MAX_BYTES = 72;

/** One password rule (AUTH-9.1), and whether a password meets it. */
export interface PasswordRuleCheck {
    /** The rule as the form lists it (AUTH-9.4). */
    rule: string;
    met: boolean;
    /** What the server says when the rule is broken. */
    message: string;
    /** Listed even while it's met; otherwise only when it's broken. */
    alwaysListed: boolean;
}

/** The password rules (AUTH-9), checked the same way by the forms, as the user types, and by the server. */
export class PasswordRules {
    static check(password: string, username: string): PasswordRuleCheck[] {
        // Characters as people count them, so an emoji is one, not two UTF-16 units
        const length = Array.from(password).length;
        const bytes = new TextEncoder().encode(password).length;
        return [
            {
                rule: `At least ${PASSWORD_MIN_LENGTH} characters`,
                met: length >= PASSWORD_MIN_LENGTH,
                message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
                alwaysListed: true
            },
            {
                rule: 'Not the same as the username',
                met: password.length === 0 || password.toLowerCase() !== username.toLowerCase(),
                message: 'Password must not be the same as the username.',
                alwaysListed: true
            },
            {
                rule: `At most ${PASSWORD_MAX_BYTES} bytes (fewer characters with accents or emoji)`,
                met: bytes <= PASSWORD_MAX_BYTES,
                message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`,
                alwaysListed: false
            }
        ];
    }

    /** The messages for each rule `password` breaks; empty if it meets them all. */
    static problems(password: string, username: string): string[] {
        return PasswordRules.check(password, username)
            .filter(check => !check.met)
            .map(check => check.message);
    }
}
