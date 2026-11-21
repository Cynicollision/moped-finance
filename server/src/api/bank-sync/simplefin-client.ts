import { parseAccountSet, SimplefinAccountSet, SimplefinMessage } from './simplefin-response';

/**
 * Why a request to Bridge failed. `refused` (403: a used or unknown setup token, or a revoked access URL) and
 * `payment-required` (402) need the user to act (SYNC-1.3); the rest may clear up by the next sync.
 */
export type SimplefinErrorKind =
    | 'invalid-setup-token'
    | 'invalid-access-url'
    | 'refused'
    | 'payment-required'
    | 'timeout'
    | 'unreachable'
    | 'unexpected-response';

/**
 * A failed request to Bridge. Its message never holds the access URL, a setup token or a response body, so it can be
 * logged and stored on a run as it is.
 */
export class SimplefinError extends Error {
    constructor(
        public readonly kind: SimplefinErrorKind,
        message: string,
        /** The `errlist` Bridge sent with a refusal, when it sent one. */
        public readonly messages: SimplefinMessage[] = []
    ) {
        super(message);
        this.name = 'SimplefinError';
    }
}

/** The only code that talks to SimpleFIN Bridge. */
export interface ISimplefinClient {
    /** Exchanges a setup token for the access URL (SYNC-1.1). A token can be claimed once. */
    claim(setupToken: string): Promise<string>;

    /** Every bank account and its transactions from `startDate` on, pending ones included, in one request. */
    fetchAccounts(accessUrl: string, startDate: Date): Promise<SimplefinAccountSet>;
}

export interface SimplefinClientOptions {
    /** For tests. */
    fetch?: typeof fetch;
    timeoutMs?: number;
}

const defaultTimeoutMs = 60_000;

/**
 * Talks to Bridge over `fetch`, which refuses URLs with credentials in them, so the access URL's user and password
 * become an `Authorization: Basic` header. Only `https:` URLs are used, there are no retries, and nothing is logged:
 * the caller decides what to record from the result or the `SimplefinError`.
 */
export class SimplefinClient implements ISimplefinClient {
    private readonly fetch: typeof fetch;
    private readonly timeoutMs: number;

    constructor(options: SimplefinClientOptions = {}) {
        this.fetch = options.fetch ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    }

    public async claim(setupToken: string): Promise<string> {
        const claimUrl = decodeSetupToken(setupToken);
        if (!claimUrl) {
            throw new SimplefinError('invalid-setup-token', 'The setup token is not a SimpleFIN claim URL.');
        }

        const response = await this.send('claim', claimUrl, { method: 'POST' });
        if (response.status === 403) {
            throw new SimplefinError('refused', 'SimpleFIN Bridge refused the setup token (403).');
        }
        if (!response.ok) {
            throw new SimplefinError(
                'unexpected-response',
                `SimpleFIN Bridge answered the claim with ${response.status}.`
            );
        }

        const accessUrl = (await this.readText('claim', response)).trim();
        if (!splitAccessUrl(accessUrl)) {
            throw new SimplefinError(
                'unexpected-response',
                'SimpleFIN Bridge answered the claim without an access URL.'
            );
        }
        return accessUrl;
    }

    public async fetchAccounts(accessUrl: string, startDate: Date): Promise<SimplefinAccountSet> {
        const access = splitAccessUrl(accessUrl);
        if (!access) {
            throw new SimplefinError('invalid-access-url', 'The access URL is not an https URL with credentials.');
        }

        const url = new URL(access.url);
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/accounts`;
        url.searchParams.set('version', '2');
        url.searchParams.set('pending', '1');
        url.searchParams.set('start-date', String(Math.floor(startDate.getTime() / 1000)));

        const response = await this.send('accounts request', url, {
            method: 'GET',
            headers: { Authorization: access.authorization, Accept: 'application/json' }
        });
        if (response.status === 403) {
            const body = parseAccountSet(await this.readJson(response).catch(() => null));
            throw new SimplefinError('refused', 'SimpleFIN Bridge refused the access URL (403).', body?.messages);
        }
        if (response.status === 402) {
            throw new SimplefinError('payment-required', 'SimpleFIN Bridge needs payment (402).');
        }
        if (!response.ok) {
            throw new SimplefinError(
                'unexpected-response',
                `SimpleFIN Bridge answered the accounts request with ${response.status}.`
            );
        }

        const accounts = parseAccountSet(await this.readJson(response));
        if (!accounts) {
            throw new SimplefinError('unexpected-response', 'SimpleFIN Bridge sent accounts in a shape we can’t read.');
        }
        return accounts;
    }

    /** Sends one request with the timeout, turning network failures into `SimplefinError`s without their URL. */
    private async send(what: string, url: URL, init: RequestInit): Promise<Response> {
        try {
            return await this.fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
        } catch (error) {
            if ((error as Error | undefined)?.name === 'TimeoutError') {
                throw new SimplefinError(
                    'timeout',
                    `SimpleFIN Bridge didn't answer the ${what} within ${this.timeoutMs / 1000}s.`
                );
            }
            // fetch's own messages ("fetch failed") don't include the URL, but its cause can, so only its code is kept.
            const code = (error as { cause?: { code?: unknown } } | undefined)?.cause?.code;
            throw new SimplefinError(
                'unreachable',
                `Couldn't reach SimpleFIN Bridge for the ${what}${typeof code === 'string' ? ` (${code})` : ''}.`
            );
        }
    }

    private async readText(what: string, response: Response): Promise<string> {
        try {
            return await response.text();
        } catch {
            throw new SimplefinError('unexpected-response', `SimpleFIN Bridge's answer to the ${what} was cut off.`);
        }
    }

    private async readJson(response: Response): Promise<unknown> {
        const text = await this.readText('accounts request', response);
        try {
            return JSON.parse(text);
        } catch {
            throw new SimplefinError('unexpected-response', 'SimpleFIN Bridge sent accounts that aren’t JSON.');
        }
    }
}

/** A setup token is a Base64-encoded `https:` claim URL. Returns null for anything else. */
function decodeSetupToken(setupToken: string): URL | null {
    const token = setupToken.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token)) {
        return null;
    }
    const url = URL.parse(Buffer.from(token, 'base64').toString('utf8'));
    return url?.protocol === 'https:' && !url.username && !url.password ? url : null;
}

/** An access URL is `https://user:password@host/path`. Returns it without the credentials, and the header for them. */
function splitAccessUrl(accessUrl: string): { url: URL; authorization: string } | null {
    const url = URL.parse(accessUrl);
    if (url?.protocol !== 'https:' || !url.username || !url.password) {
        return null;
    }
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    url.username = '';
    url.password = '';
    return { url, authorization: `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}` };
}
