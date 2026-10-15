import { PasswordRules } from './password-rules';

describe('PasswordRules', () => {
    it('AUTH-9.1 should need at least 8 characters, counting characters rather than UTF-16 units', () => {
        expect(PasswordRules.problems('a'.repeat(7), 'ada')).toEqual(['Password must be at least 8 characters.']);
        expect(PasswordRules.problems('a'.repeat(8), 'ada')).toEqual([]);
        // Seven emoji are 14 UTF-16 units but seven characters
        expect(PasswordRules.problems('😀'.repeat(7), 'ada')).toEqual(['Password must be at least 8 characters.']);
    });

    it('AUTH-9.1 should refuse the username, ignoring case', () => {
        expect(PasswordRules.problems('AdaLovelace', 'adalovelace')).toEqual([
            'Password must not be the same as the username.'
        ]);
    });

    it('AUTH-9.1 should refuse more than 72 bytes, which bcrypt would cut short', () => {
        expect(PasswordRules.problems('a'.repeat(72), 'ada')).toEqual([]);
        expect(PasswordRules.problems('a'.repeat(73), 'ada')).toEqual(['Password must be at most 72 bytes.']);
        // 37 two-byte characters are 74 bytes
        expect(PasswordRules.problems('é'.repeat(37), 'ada')).toEqual(['Password must be at most 72 bytes.']);
    });

    it('AUTH-9.4 should name every rule broken', () => {
        expect(PasswordRules.problems('ada', 'ada')).toEqual([
            'Password must be at least 8 characters.',
            'Password must not be the same as the username.'
        ]);
    });

    it('AUTH-9.4 should list the byte limit only when it is broken', () => {
        const listed = (password: string) =>
            PasswordRules.check(password, 'ada')
                .filter(check => check.alwaysListed || !check.met)
                .map(check => check.rule);

        expect(listed('short')).toEqual(['At least 8 characters', 'Not the same as the username']);
        expect(listed('a'.repeat(73))).toHaveLength(3);
    });
});
