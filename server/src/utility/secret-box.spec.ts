import { randomBytes } from 'crypto';
import { SecretBox, SecretBoxError } from './secret-box';

const accessUrl = 'https://user:password@bridge.example/simplefin';
const keyText = () => randomBytes(32).toString('base64');

describe('SecretBox', () => {
    it('SYNC-1.2 should open what it sealed', () => {
        const box = SecretBox.fromEnvironment({ ENCRYPTION_KEY: keyText() })!;

        const sealed = box.seal(accessUrl);

        expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
        expect(sealed).not.toContain('password');
        expect(box.open(sealed)).toBe(accessUrl);
        expect(box.open(box.seal(''))).toBe('');
        expect(box.open(box.seal('café ✓'))).toBe('café ✓');
    });

    it('SYNC-1.2 should seal the same value differently each time', () => {
        const box = new SecretBox(randomBytes(32));

        expect(box.seal(accessUrl)).not.toBe(box.seal(accessUrl));
    });

    it('SYNC-1.3 should refuse a value sealed with another key', () => {
        const sealed = new SecretBox(randomBytes(32)).seal(accessUrl);

        expect(() => new SecretBox(randomBytes(32)).open(sealed)).toThrow(SecretBoxError);
    });

    it('SYNC-1.3 should refuse a tampered value', () => {
        const box = new SecretBox(randomBytes(32));
        const [version, iv, tag, ciphertext] = box.seal(accessUrl).split('.');
        const flip = (part: string) => {
            const bytes = Buffer.from(part, 'base64url');
            bytes[0] ^= 1;
            return bytes.toString('base64url');
        };

        for (const tampered of [
            [version, iv, tag, flip(ciphertext)],
            [version, iv, flip(tag), ciphertext],
            [version, flip(iv), tag, ciphertext],
            ['v2', iv, tag, ciphertext],
            [version, iv, tag],
            [version, iv, tag.slice(0, 8), ciphertext]
        ]) {
            expect(() => box.open(tampered.join('.'))).toThrow(SecretBoxError);
        }
        expect(() => box.open(accessUrl)).toThrow(SecretBoxError);
        expect(() => box.open('')).toThrow(SecretBoxError);
    });

    it('SYNC-1.2 should be unavailable when ENCRYPTION_KEY is unset or blank', () => {
        expect(SecretBox.fromEnvironment({})).toBeUndefined();
        expect(SecretBox.fromEnvironment({ ENCRYPTION_KEY: '  ' })).toBeUndefined();
    });

    it('SYNC-1.2 should accept the key with spaces around it', () => {
        const key = keyText();
        const sealed = SecretBox.fromEnvironment({ ENCRYPTION_KEY: key })!.seal(accessUrl);

        expect(SecretBox.fromEnvironment({ ENCRYPTION_KEY: ` ${key}\n` })!.open(sealed)).toBe(accessUrl);
    });

    it.each([
        ['too short', randomBytes(16).toString('base64')],
        ['too long', randomBytes(48).toString('base64')],
        ['not Base64', 'not a key at all, just a sentence of text!!'],
        ['Base64url', randomBytes(32).toString('base64url')],
        ['Base64 with a stray character', `${keyText().slice(0, 20)}*${keyText().slice(20)}`],
        ['hex', randomBytes(32).toString('hex')]
    ])('SYNC-1.2 should refuse an ENCRYPTION_KEY that’s %s, naming the variable but not its value', (_, value) => {
        let message = '';
        try {
            SecretBox.fromEnvironment({ ENCRYPTION_KEY: value });
        } catch (error) {
            message = (error as Error).message;
        }

        expect(message).toContain('ENCRYPTION_KEY');
        expect(message).not.toContain(value);
    });
});
