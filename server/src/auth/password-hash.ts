import * as bcrypt from 'bcrypt';

/** Passwords are kept only as salted bcrypt hashes (AUTH-2.6). */
export class PasswordHash {
    private static readonly rounds = 10;

    public static create(password: string): Promise<string> {
        return bcrypt.hash(password, PasswordHash.rounds);
    }

    public static matches(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}
