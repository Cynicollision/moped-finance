import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const algorithm = 'aes-256-gcm';
const keyBytes = 32;
const ivBytes = 12;
const tagBytes = 16;
const version = 'v1';

/** Raised by `open` for a value sealed with another key, changed since, or not sealed at all. */
export class SecretBoxError extends Error {
    constructor() {
        super("The value can't be decrypted: it was sealed with another key, or it has been changed.");
        this.name = 'SecretBoxError';
    }
}

/**
 * Encrypts secrets the server stores, such as the SimpleFIN access URL (SYNC-1.2), with the key in `ENCRYPTION_KEY`:
 * AES-256-GCM with a random IV per value, stored as `v1.<iv>.<tag>.<ciphertext>` in Base64url. It keeps the secrets
 * out of database backups and dumps, which don't hold the key; it doesn't protect against a compromised host.
 */
export class SecretBox {
    private readonly key: Buffer;

    constructor(key: Buffer) {
        if (key.length !== keyBytes) {
            throw new Error(`A SecretBox key must be ${keyBytes} bytes.`);
        }
        this.key = Buffer.from(key);
    }

    /**
     * The box for `ENCRYPTION_KEY`, or undefined when it isn't set. Throws, naming the variable but not its value, when
     * it isn't 32 bytes of standard Base64, so the server refuses to start.
     */
    public static fromEnvironment(env: NodeJS.ProcessEnv): SecretBox | undefined {
        const text = env.ENCRYPTION_KEY?.trim();
        if (!text) {
            return undefined;
        }
        const key = Buffer.from(text, 'base64');
        // Buffer.from skips characters that aren't Base64, so check that the text is exactly the key's encoding.
        if (key.length !== keyBytes || key.toString('base64') !== text) {
            throw new Error(
                `ENCRYPTION_KEY must be ${keyBytes} random bytes in Base64, as made by 'openssl rand -base64 32'.`
            );
        }
        return new SecretBox(key);
    }

    public seal(plaintext: string): string {
        const iv = randomBytes(ivBytes);
        const cipher = createCipheriv(algorithm, this.key, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        return [version, iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
    }

    /** The plaintext `seal` was given. Throws `SecretBoxError` for anything it can't decrypt and authenticate. */
    public open(sealed: string): string {
        const parts = sealed.split('.');
        if (parts.length !== 4 || parts[0] !== version) {
            throw new SecretBoxError();
        }
        const [iv, tag, ciphertext] = parts.slice(1).map(part => Buffer.from(part, 'base64url'));
        if (iv.length !== ivBytes || tag.length !== tagBytes) {
            throw new SecretBoxError();
        }
        try {
            const decipher = createDecipheriv(algorithm, this.key, iv, { authTagLength: tagBytes });
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
        } catch {
            throw new SecretBoxError();
        }
    }
}
