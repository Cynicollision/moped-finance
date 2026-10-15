import { PasswordPolicy } from './password-policy';

describe('PasswordPolicy', () => {
    it('AUTH-9.1 should default to 12 characters when PASSWORD_MIN_LENGTH is unset or empty', () => {
        expect(PasswordPolicy.fromEnvironment(undefined).minLength).toBe(12);
        expect(PasswordPolicy.fromEnvironment(' ').minLength).toBe(12);
    });

    it('AUTH-9.1 should accept PASSWORD_MIN_LENGTH from 8 to 64', () => {
        expect(PasswordPolicy.fromEnvironment('8').minLength).toBe(8);
        expect(PasswordPolicy.fromEnvironment('64').minLength).toBe(64);
    });

    it('AUTH-9.1 should refuse any other PASSWORD_MIN_LENGTH, so the server does not start', () => {
        for (const value of ['7', '65', '12.5', 'twelve']) {
            expect(() => PasswordPolicy.fromEnvironment(value)).toThrow(
                `PASSWORD_MIN_LENGTH must be a whole number from 8 to 64; it's "${value}".`
            );
        }
    });
});
