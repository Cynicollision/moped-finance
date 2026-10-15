import { PasswordRules } from './password-rules';

describe('PasswordRules', () => {
    it('AUTH-9.1 should need at least the minimum length, counting characters rather than UTF-16 units', () => {
        expect(PasswordRules.problems('a'.repeat(11), 'ada', 12)).toEqual(['Password must be at least 12 characters.']);
        expect(PasswordRules.problems('a'.repeat(12), 'ada', 12)).toEqual([]);
        // Eleven emoji are 22 UTF-16 units but eleven characters
        expect(PasswordRules.problems('😀'.repeat(11), 'ada', 12)).toEqual([
            'Password must be at least 12 characters.'
        ]);
    });

    it('AUTH-9.1 should refuse the username, ignoring case', () => {
        expect(PasswordRules.problems('AdaLovelace1', 'adalovelace1', 8)).toEqual([
            'Password must not be the same as the username.'
        ]);
    });

    it('AUTH-9.1 should refuse more than 72 bytes, which bcrypt would cut short', () => {
        expect(PasswordRules.problems('a'.repeat(72), 'ada', 12)).toEqual([]);
        expect(PasswordRules.problems('a'.repeat(73), 'ada', 12)).toEqual(['Password must be at most 72 bytes.']);
        // 37 two-byte characters are 74 bytes
        expect(PasswordRules.problems('é'.repeat(37), 'ada', 12)).toEqual(['Password must be at most 72 bytes.']);
    });

    it('AUTH-9.4 should name every rule broken', () => {
        expect(PasswordRules.problems('ada', 'ada', 12)).toEqual([
            'Password must be at least 12 characters.',
            'Password must not be the same as the username.'
        ]);
    });

    it('AUTH-9.4 should list the byte limit only when it is broken', () => {
        const listed = (password: string) =>
            PasswordRules.check(password, 'ada', 12)
                .filter(check => check.alwaysListed || !check.met)
                .map(check => check.rule);

        expect(listed('short')).toEqual(['At least 12 characters', 'Not the same as the username']);
        expect(listed('a'.repeat(73))).toHaveLength(3);
    });
});
