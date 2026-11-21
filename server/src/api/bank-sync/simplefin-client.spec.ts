import fs from 'fs';
import path from 'path';
import { SimplefinClient, SimplefinError } from './simplefin-client';
import { parseAccountSet } from './simplefin-response';

const fixture = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(__dirname, 'test-data', name), 'utf8'));

const fixtureNames = fs.readdirSync(path.join(__dirname, 'test-data')).filter(name => name.endsWith('.json'));

// Made up: the demo token's access URL isn't recorded. The password needs percent-decoding.
const accessUrl = 'https://demo-user:s3cr%40t@bridge.example/simplefin';
const claimUrl = 'https://bridge.example/simplefin/claim/DEMO-TOKEN';
const setupToken = Buffer.from(claimUrl).toString('base64');
const startDate = new Date('2026-10-08T12:00:00Z');

type FetchStub = jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

function stubFetch(respond: () => Response | Promise<Response>): FetchStub {
    return jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => respond());
}

/** The client always passes a URL and an init. */
const request = (fetch: FetchStub, index = 0) => fetch.mock.calls[index] as [URL, RequestInit];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function failure(promise: Promise<unknown>): Promise<SimplefinError> {
    const error = await promise.then(
        () => undefined,
        (e: unknown) => e
    );
    expect(error).toBeInstanceOf(SimplefinError);
    return error as SimplefinError;
}

/** Nothing secret in an error: it gets logged and stored on runs. */
function expectNoSecrets(error: SimplefinError) {
    const text = `${error.message} ${JSON.stringify(error.messages)}`;
    for (const secret of ['demo-user', 's3cr', 'bridge.example', setupToken, 'DEMO-TOKEN']) {
        expect(text).not.toContain(secret);
    }
}

describe('parseAccountSet', () => {
    it.each(fixtureNames)('SYNC-3.6 should read the recorded %s', name => {
        expect(parseAccountSet(fixture(name))).not.toBeNull();
    });

    it('SYNC-4.2 should read a v2 response into connections, accounts and transactions', () => {
        const set = parseAccountSet(fixture('accounts-v2.json'))!;

        expect(set.connections).toEqual([
            {
                id: 'CON-SIMPLEFIN-DEMO',
                name: 'SimpleFIN Demo',
                orgId: 'simplefin.demoorg',
                orgName: 'SimpleFIN Bridge',
                orgUrl: 'https://beta-bridge.simplefin.org'
            }
        ]);
        expect(set.accounts.map(a => [a.id, a.connectionId, a.currency, a.transactions.length])).toEqual([
            ['Demo Savings', 'CON-SIMPLEFIN-DEMO', 'USD', 87],
            ['Demo Checking', 'CON-SIMPLEFIN-DEMO', 'USD', 87],
            ['Demo Empty Account', 'CON-SIMPLEFIN-DEMO', 'USD', 0]
        ]);
        expect(set.messages).toEqual([]);

        const savings = set.accounts[0];
        expect(savings).toMatchObject({ name: 'SimpleFIN Savings', availableBalance: savings.balance });
        expect(typeof savings.balance).toBe('number');
        expect(savings.transactions[0]).toEqual({
            id: expect.any(String),
            posted: expect.any(Number),
            amount: expect.any(Number),
            description: expect.any(String),
            payee: expect.any(String),
            memo: expect.any(String),
            transactedAt: expect.any(Number),
            pending: false
        });
    });

    it('SYNC-4.2 should keep the payee, description and memo as Bridge gives them', () => {
        const set = parseAccountSet(fixture('accounts-v2-default-window.json'))!;

        expect(set.accounts[0].transactions[0]).toEqual({
            id: '1795248000',
            posted: 1795248000,
            amount: -105.5,
            description: 'Fishing bait',
            payee: "John's Fishin Shack",
            memo: 'JOHNS FISHIN SHACK BAIT',
            transactedAt: 1795248000,
            pending: false
        });
        expect(set.accounts[0]).toMatchObject({
            balance: 114545.51,
            availableBalance: 114545.51,
            balanceDate: 1795305600
        });
    });

    it('should read v1 into the same accounts as v2, with a connection for each org', () => {
        const v1 = parseAccountSet(fixture('accounts-v1.json'))!;
        const v2 = parseAccountSet(fixture('accounts-v2-default-window.json'))!;

        expect(v1.connections).toEqual([
            {
                id: 'simplefin.demoorg',
                name: 'SimpleFIN Demo',
                orgId: 'simplefin.demoorg',
                orgName: 'SimpleFIN Demo',
                orgUrl: 'https://beta-bridge.simplefin.org'
            }
        ]);
        const withoutConnection = (set: typeof v1) => set.accounts.map(({ connectionId: _, ...account }) => account);
        expect(withoutConnection(v1)).toEqual(withoutConnection(v2));
        expect(v1.accounts.every(a => a.connectionId === 'simplefin.demoorg')).toBe(true);
    });

    it('SYNC-5.2 should keep Bridge’s messages as it wrote them, from errlist, errors and x-api-message', () => {
        const warning = 'Requested date range exceeds recommended range of 45 days. In the future, this may be capped.';

        expect(parseAccountSet(fixture('accounts-v2-range-warning.json'))!.messages).toEqual([
            { code: 'gen.api', text: warning, connectionId: null, accountId: null }
        ]);
        expect(parseAccountSet(fixture('accounts-v1-range-warning.json'))!.messages).toEqual([
            { code: null, text: warning, connectionId: null, accountId: null }
        ]);
        expect(parseAccountSet(fixture('accounts-v2-default-window.json'))!.messages).toEqual([
            {
                code: null,
                text: "Provide a 'start-date' parameter to receive transactions prior to yesterday",
                connectionId: null,
                accountId: null
            }
        ]);
        expect(
            parseAccountSet({
                errlist: [{ code: 'con.auth', msg: 'Sign in again', conn_id: 'CON-1', account_id: 'ACT-1' }],
                connections: [],
                accounts: []
            })!.messages
        ).toEqual([{ code: 'con.auth', text: 'Sign in again', connectionId: 'CON-1', accountId: 'ACT-1' }]);
    });

    it('SYNC-4.7 should mark pending transactions, including ones not posted yet', () => {
        const checking = parseAccountSet(fixture('accounts-v2-pending-edited.json'))!.accounts[1];

        expect(checking.transactions.map(t => [t.pending, t.posted])).toEqual([
            [false, 1795248000],
            [false, 1795276800],
            [true, 1795334400],
            [true, 0]
        ]);
    });

    it('should read optional fields when they are missing or blank', () => {
        const set = parseAccountSet({
            errlist: [],
            connections: [{ conn_id: 'CON-1', name: 'Bank' }],
            accounts: [
                {
                    id: 'A',
                    name: 'Balances only',
                    conn_id: 'CON-1',
                    currency: 'USD',
                    balance: '-12',
                    'balance-date': 1
                },
                {
                    id: 'B',
                    name: 'Card',
                    conn_id: 'CON-1',
                    currency: 'USD',
                    balance: '+3.10',
                    'balance-date': 1,
                    transactions: [{ id: 'T', posted: 5, amount: '1.00', description: 'Coffee', payee: '  ' }]
                }
            ]
        })!;

        expect(set.connections[0]).toEqual({ id: 'CON-1', name: 'Bank', orgId: null, orgName: null, orgUrl: null });
        expect(set.accounts[0]).toMatchObject({ balance: -12, availableBalance: null, transactions: [] });
        expect(set.accounts[1].balance).toBe(3.1);
        expect(set.accounts[1].transactions[0]).toMatchObject({
            payee: null,
            memo: null,
            transactedAt: null,
            pending: false
        });
    });

    describe('should refuse a malformed response', () => {
        const account = {
            id: 'A',
            name: 'Checking',
            conn_id: 'CON-1',
            currency: 'USD',
            balance: '1.00',
            'balance-date': 1
        };
        const body = (changes: object, transaction?: object) => ({
            errlist: [],
            connections: [{ conn_id: 'CON-1', name: 'Bank' }],
            accounts: [
                {
                    ...account,
                    ...changes,
                    transactions: transaction
                        ? [{ id: 'T', posted: 1, amount: '1', description: 'x', ...transaction }]
                        : []
                }
            ]
        });

        it.each([
            ['not an object', 'accounts'],
            ['no accounts', { errlist: [], connections: [] }],
            ['an account without an ID', body({ id: '' })],
            ['an account without a currency', body({ currency: undefined })],
            ['a balance that isn’t a number', body({ balance: 'abc' })],
            ['a balance in exponent form', body({ balance: '1e3' })],
            ['a balance given as a number', body({ balance: 1 })],
            ['a negative timestamp', body({ 'balance-date': -1 })],
            ['a transaction without an ID', body({}, { id: undefined })],
            ['a transaction amount that’s blank', body({}, { amount: '' })],
            ['a transaction amount in hex', body({}, { amount: '0x10' })],
            ['a transaction without a description', body({}, { description: undefined })],
            ['a transaction posted at a fraction of a second', body({}, { posted: 1.5 })],
            ['a v1 account without an org', { errors: [], accounts: [{ ...account, conn_id: undefined }] }]
        ])('%s', (_, response) => {
            expect(parseAccountSet(response)).toBeNull();
        });
    });
});

describe('SimplefinClient', () => {
    describe('claim', () => {
        it('SYNC-1.1 should post to the setup token’s claim URL and return the access URL', async () => {
            const fetch = stubFetch(() => new Response(`${accessUrl}\n`));
            const client = new SimplefinClient({ fetch });

            await expect(client.claim(`  ${setupToken.slice(0, 10)}\n${setupToken.slice(10)} `)).resolves.toBe(
                accessUrl
            );

            expect(fetch).toHaveBeenCalledTimes(1);
            const [url, init] = request(fetch);
            expect(url.href).toBe(claimUrl);
            expect(init).toMatchObject({ method: 'POST', signal: expect.any(AbortSignal) });
            expect(init.body).toBeUndefined();
        });

        it('SYNC-1.1 should report a token Bridge refuses as refused', async () => {
            const client = new SimplefinClient({
                fetch: stubFetch(() => new Response('Forbidden (was it already claimed?)', { status: 403 }))
            });

            const error = await failure(client.claim(setupToken));

            expect(error.kind).toBe('refused');
            expectNoSecrets(error);
        });

        it.each([
            ['not Base64', 'not a token!'],
            ['blank', '  '],
            ['not a URL', Buffer.from('hello').toString('base64')],
            ['an http claim URL', Buffer.from('http://bridge.example/simplefin/claim/X').toString('base64')],
            ['a claim URL with credentials', Buffer.from('https://a:b@bridge.example/claim/X').toString('base64')]
        ])('should refuse a setup token that’s %s without sending it anywhere', async (_, token) => {
            const fetch = stubFetch(() => new Response(accessUrl));

            const error = await failure(new SimplefinClient({ fetch }).claim(token));

            expect(error.kind).toBe('invalid-setup-token');
            expect(fetch).not.toHaveBeenCalled();
        });

        it.each([
            ['an http access URL', 'http://user:pass@bridge.example/simplefin'],
            ['a URL without credentials', 'https://bridge.example/simplefin'],
            ['an HTML page', '<html>Something went wrong</html>']
        ])('should refuse a claim answered with %s', async (_, body) => {
            const error = await failure(
                new SimplefinClient({ fetch: stubFetch(() => new Response(body)) }).claim(setupToken)
            );

            expect(error.kind).toBe('unexpected-response');
            expect(error.message).not.toContain(body);
        });

        it('should report another status as an unexpected response', async () => {
            const client = new SimplefinClient({ fetch: stubFetch(() => new Response('', { status: 500 })) });

            expect((await failure(client.claim(setupToken))).kind).toBe('unexpected-response');
        });
    });

    describe('fetchAccounts', () => {
        it('SYNC-3.6 should ask once for v2 with pending transactions from the start date, with the credentials in a header', async () => {
            const fetch = stubFetch(() => json(fixture('accounts-v2.json')));

            const set = await new SimplefinClient({ fetch }).fetchAccounts(accessUrl, startDate);

            expect(set.accounts).toHaveLength(3);
            expect(fetch).toHaveBeenCalledTimes(1);
            const [url, init] = request(fetch);
            expect(url.href).toBe(
                `https://bridge.example/simplefin/accounts?version=2&pending=1&start-date=${startDate.getTime() / 1000}`
            );
            expect(url.username).toBe('');
            expect(url.password).toBe('');
            expect(init.method).toBe('GET');
            expect(init.headers).toEqual({
                Authorization: `Basic ${Buffer.from('demo-user:s3cr@t').toString('base64')}`,
                Accept: 'application/json'
            });
            expect(init.signal).toBeInstanceOf(AbortSignal);
        });

        it('should not double the slash when the access URL ends in one', async () => {
            const fetch = stubFetch(() => json(fixture('accounts-v2.json')));

            await new SimplefinClient({ fetch }).fetchAccounts(`${accessUrl}/`, startDate);

            expect(request(fetch)[0].pathname).toBe('/simplefin/accounts');
        });

        it.each([
            ['http', 'http://user:pass@bridge.example/simplefin'],
            ['without credentials', 'https://bridge.example/simplefin'],
            ['without a password', 'https://user@bridge.example/simplefin'],
            ['not a URL', 'nonsense']
        ])('should refuse an access URL that’s %s without sending it', async (_, url) => {
            const fetch = stubFetch(() => json(fixture('accounts-v2.json')));

            const error = await failure(new SimplefinClient({ fetch }).fetchAccounts(url, startDate));

            expect(error.kind).toBe('invalid-access-url');
            expect(error.message).not.toContain(url);
            expect(fetch).not.toHaveBeenCalled();
        });

        it('SYNC-1.3 should report a 403 as refused, with Bridge’s errlist', async () => {
            const client = new SimplefinClient({
                fetch: stubFetch(() => json(fixture('accounts-forbidden.json'), 403))
            });

            const error = await failure(client.fetchAccounts(accessUrl, startDate));

            expect(error.kind).toBe('refused');
            expect(error.messages).toEqual([
                { code: 'gen.auth', text: 'Forbidden', connectionId: null, accountId: null }
            ]);
            expectNoSecrets(error);
        });

        it('SYNC-1.3 should report a 403 without a readable body as refused', async () => {
            const client = new SimplefinClient({ fetch: stubFetch(() => new Response('Forbidden', { status: 403 })) });

            const error = await failure(client.fetchAccounts(accessUrl, startDate));

            expect(error.kind).toBe('refused');
            expect(error.messages).toEqual([]);
        });

        it('SYNC-1.3 should report a 402 as payment required', async () => {
            const client = new SimplefinClient({ fetch: stubFetch(() => new Response('', { status: 402 })) });

            const error = await failure(client.fetchAccounts(accessUrl, startDate));

            expect(error.kind).toBe('payment-required');
            expectNoSecrets(error);
        });

        it.each([
            ['another status', () => new Response('Bad gateway', { status: 502 })],
            ['a body that isn’t JSON', () => new Response('<html>oops</html>')],
            ['JSON in another shape', () => json({ accounts: 'none' })]
        ])('should report %s as an unexpected response', async (_, respond) => {
            const error = await failure(
                new SimplefinClient({ fetch: stubFetch(respond) }).fetchAccounts(accessUrl, startDate)
            );

            expect(error.kind).toBe('unexpected-response');
            expect(error.message).not.toMatch(/oops|gateway|none/);
            expectNoSecrets(error);
        });

        it('should give up after the timeout', async () => {
            // Like fetch: rejects with the signal's reason when it aborts.
            const fetch: FetchStub = jest.fn(
                (_url, init) =>
                    new Promise((_resolve, reject) =>
                        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))
                    )
            );

            const error = await failure(
                new SimplefinClient({ fetch, timeoutMs: 20 }).fetchAccounts(accessUrl, startDate)
            );

            expect(error.kind).toBe('timeout');
            expectNoSecrets(error);
        });

        it('should give a 60-second timeout by default', async () => {
            const timeout = jest.spyOn(AbortSignal, 'timeout');

            await new SimplefinClient({ fetch: stubFetch(() => json(fixture('accounts-v2.json'))) }).fetchAccounts(
                accessUrl,
                startDate
            );

            expect(timeout).toHaveBeenCalledWith(60_000);
        });

        it('should report a network failure as unreachable, keeping only its code', async () => {
            const cause = Object.assign(new Error(`getaddrinfo ENOTFOUND bridge.example ${accessUrl}`), {
                code: 'ENOTFOUND'
            });
            const client = new SimplefinClient({
                fetch: stubFetch(() => Promise.reject(Object.assign(new TypeError('fetch failed'), { cause })))
            });

            const error = await failure(client.fetchAccounts(accessUrl, startDate));

            expect(error.kind).toBe('unreachable');
            expect(error.message).toContain('ENOTFOUND');
            expectNoSecrets(error);
        });
    });
});
