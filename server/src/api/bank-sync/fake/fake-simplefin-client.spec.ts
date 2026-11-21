import { DateTimeUtil } from '@server/utility';
import { ISimplefinClient, SimplefinError } from './../simplefin-client';
import { simplefinClientFromEnvironment } from './../simplefin-client-factory';
import { parseAccountSet, SimplefinAccountSet, SimplefinTransaction } from './../simplefin-response';
import { fakeAccountIds } from './fake-banks';
import { FakeBridge, fakeChangeDelaySeconds } from './fake-bridge';
import { fakeScenarios } from './fake-scenarios';
import { DevelopmentSimplefinClient, FakeSimplefinClient } from './fake-simplefin-client';

const day = 24 * 60 * 60 * 1000;
// 10:00 in New York, where the tests run.
const morning = new Date('2026-11-21T15:00:00Z');

/** A sync's window: 44 days back from the clock (SYNC-3.6). */
const windowStart = () => DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -44 * day);

async function connect(scenario: string, client = new FakeSimplefinClient({ timeoutMs: 20 })) {
    const accessUrl = await client.claim(scenario === 'healthy' ? 'fake' : `fake:${scenario}`);
    return { client, accessUrl, fetch: (start = windowStart()) => client.fetchAccounts(accessUrl, start) };
}

function at(date: Date) {
    DateTimeUtil.setClock(date);
}

/** Asks the fake Bridge directly, for queries the client never sends. */
function rawFetch(accessUrl: string, query: string) {
    const { username, password } = new URL(accessUrl);
    return new FakeBridge().fetch(new URL(`https://fake-bridge.simplefin.invalid/simplefin/accounts?${query}`), {
        headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
    });
}

const account = (set: SimplefinAccountSet, id: string) => set.accounts.find(a => a.id === id)!;
const byId = (transactions: SimplefinTransaction[]) => new Map(transactions.map(t => [t.id, t]));

async function failure(promise: Promise<unknown>): Promise<SimplefinError> {
    const error = await promise.then(
        () => undefined,
        (e: unknown) => e
    );
    expect(error).toBeInstanceOf(SimplefinError);
    return error as SimplefinError;
}

const answering = fakeScenarios.filter(s => !['refused', 'payment', 'down'].includes(s));

describe('FakeSimplefinClient', () => {
    beforeEach(() => at(morning));

    describe('every scenario', () => {
        it.each(answering)('should answer %s in a shape T2’s parser reads, v2 or v1', async scenario => {
            const { accessUrl, fetch } = await connect(scenario);

            for (const query of ['version=2&pending=1', 'pending=1', 'version=2', '']) {
                const response = await rawFetch(accessUrl, query);
                expect(parseAccountSet(await response.json())).not.toBeNull();
            }
            await expect(fetch()).resolves.toBeDefined();
        });

        it.each(answering)('should give the same payload all day for %s', async scenario => {
            const { fetch } = await connect(scenario);
            const start = windowStart();
            at(new Date(morning.getTime() + 2 * 60_000));
            const early = await fetch(start);

            at(new Date('2026-11-22T01:30:00Z')); // 20:30 the same day in New York

            expect(await fetch(start)).toEqual(early);
        });
    });

    it('should mirror the seed data’s banks, plus one new bank account and one in Canadian dollars', async () => {
        const set = await (await connect('healthy')).fetch();

        expect(set.connections.map(c => c.name)).toEqual([
            'Harbor Community Bank',
            'Summit Credit Union',
            'Lakeside Home Loans',
            'Maple Leaf Trust'
        ]);
        expect(
            set.accounts.map(a => [set.connections.find(c => c.id === a.connectionId)!.name, a.name, a.currency])
        ).toEqual([
            ['Harbor Community Bank', 'Everyday Checking', 'USD'],
            ['Harbor Community Bank', 'High-Yield Savings', 'USD'],
            ['Harbor Community Bank', 'Holiday Fund', 'USD'],
            ['Summit Credit Union', 'Rewards Visa', 'USD'],
            ['Lakeside Home Loans', 'Mortgage', 'USD'],
            ['Maple Leaf Trust', 'Chequing', 'CAD']
        ]);
        expect(account(set, fakeAccountIds.visa).balance).toBeLessThan(0);
        expect(account(set, fakeAccountIds.mortgage).balance).toBeLessThan(0);
        expect(set.messages).toEqual([]);
    });

    it('should add a few transactions each day, keeping each balance in step with them', async () => {
        const { fetch } = await connect('healthy');
        const start = windowStart();
        const today = await fetch(start);
        at(new Date(morning.getTime() + day));
        const tomorrow = await fetch(start);

        let added = 0;
        for (const before of today.accounts) {
            const after = account(tomorrow, before.id);
            const known = byId(before.transactions);
            const newOnes = after.transactions.filter(t => !known.has(t.id));
            expect(after.transactions.filter(t => known.has(t.id))).toEqual(before.transactions);
            const change = newOnes.reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
            expect(Math.round(after.balance * 100) - Math.round(before.balance * 100)).toBe(change);
            added += newOnes.length;
        }
        expect(added).toBeGreaterThan(0);
        expect(added).toBeLessThan(15);
    });

    it('should cover the whole window, posting nothing after today and no pending transactions', async () => {
        const set = await (await connect('healthy')).fetch();
        const checking = account(set, fakeAccountIds.checking).transactions;
        const posted = checking.map(t => t.posted * 1000);

        expect(Math.min(...posted)).toBeGreaterThanOrEqual(windowStart().getTime());
        expect(Math.min(...posted)).toBeLessThan(windowStart().getTime() + 3 * day);
        expect(Math.max(...set.accounts.flatMap(a => a.transactions.map(t => t.posted * 1000)))).toBeLessThan(
            new Date('2026-11-22T05:00:00Z').getTime()
        );
        expect(set.accounts.flatMap(a => a.transactions).some(t => t.pending)).toBe(false);
    });

    it('SYNC-4.2 should say when card purchases happened, the day before they post, and give a payee', async () => {
        const set = await (await connect('healthy')).fetch();
        const purchases = account(set, fakeAccountIds.visa).transactions.filter(t => t.amount < 0);
        const checking = account(set, fakeAccountIds.checking).transactions;

        expect(purchases.length).toBeGreaterThan(20);
        for (const purchase of purchases) {
            expect(purchase.transactedAt).not.toBeNull();
            expect(purchase.posted).toBeGreaterThan(purchase.transactedAt!);
            expect(purchase.payee).toBeTruthy();
            expect(purchase.description).toMatch(/^[A-Z0-9 #*.\-']+$/);
        }
        expect(checking.every(t => t.transactedAt === null)).toBe(true);
    });

    it('should answer in v1 for fake:v1, even when asked for v2', async () => {
        const set = await (await connect('v1')).fetch();

        expect(set.connections.map(c => c.id)).toEqual([
            'harbor.example',
            'summit.example',
            'lakeside.example',
            'mapleleaf.example'
        ]);
    });

    it('should warn, as Bridge does, about a window longer than 44 days', async () => {
        const { fetch } = await connect('healthy');

        expect((await fetch(DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -45 * day))).messages).toEqual([
            expect.objectContaining({ code: 'gen.api', text: expect.stringContaining('recommended range of 45 days') })
        ]);
    });

    it('SYNC-2.2 should list a new bank account for fake:new-account after the first sync', async () => {
        const { fetch } = await connect('new-account');
        const connecting = await fetch();
        at(new Date(morning.getTime() + fakeChangeDelaySeconds * 1000));
        const later = await fetch();

        expect(connecting.accounts.map(a => a.id)).not.toContain(fakeAccountIds.certificate);
        expect(account(later, fakeAccountIds.certificate)).toMatchObject({
            name: 'Share Certificate',
            currency: 'USD'
        });
        expect(later.accounts).toHaveLength(connecting.accounts.length + 1);
    });

    it('SYNC-2.9 should stop returning High-Yield Savings for fake:missing after the first sync', async () => {
        const { fetch } = await connect('missing');
        const connecting = await fetch();
        at(new Date(morning.getTime() + fakeChangeDelaySeconds * 1000));
        const later = await fetch();

        expect(account(connecting, fakeAccountIds.savings)).toBeDefined();
        expect(later.accounts.map(a => a.id)).not.toContain(fakeAccountIds.savings);
        expect(later.accounts).toHaveLength(connecting.accounts.length - 1);
    });

    it('SYNC-4.4 should change a few posted card purchases’ amount, description and date for fake:corrections', async () => {
        const { fetch } = await connect('corrections');
        const start = windowStart();
        const yesterday = new Date(morning.getTime() - day);
        at(yesterday);
        const before = byId(account(await fetch(start), fakeAccountIds.visa).transactions);
        at(new Date(morning.getTime() + 2 * day));
        const after = account(await fetch(start), fakeAccountIds.visa).transactions;

        const changed = after.filter(t => before.has(t.id) && before.get(t.id)!.amount !== t.amount);
        expect(changed.length).toBeGreaterThan(0);
        for (const transaction of changed) {
            const was = before.get(transaction.id)!;
            expect(transaction.amount).toBeCloseTo(was.amount - 2, 2);
            expect(transaction.description).toBe(`${was.description} ADJ`);
            expect(transaction.transactedAt).toBe(was.transactedAt! - 24 * 60 * 60);
            expect(transaction.posted).toBe(was.posted);
        }
        // Everything else is as healthy has it.
        const healthy = byId(account(await (await connect('healthy')).fetch(start), fakeAccountIds.visa).transactions);
        expect(after.map(t => t.id)).toEqual([...healthy.keys()]);
        for (const transaction of after.filter(t => t.amount !== healthy.get(t.id)!.amount)) {
            expect(transaction.description).toBe(`${healthy.get(transaction.id)!.description} ADJ`);
        }
    });

    describe('SYNC-4.7 fake:pending', () => {
        /** The Visa's transactions on each of 21 days of daily syncs. */
        async function syncDaily() {
            const { fetch } = await connect('pending');
            const days: SimplefinTransaction[][] = [];
            for (let i = 0; i < 21; i++) {
                at(new Date(morning.getTime() + i * day));
                days.push(account(await fetch(), fakeAccountIds.visa).transactions);
            }
            return days;
        }

        it('should send card purchases as pending first, without a posted date', async () => {
            const days = await syncDaily();
            const pending = days.flat().filter(t => t.pending);

            expect(pending.length).toBeGreaterThan(0);
            expect(pending.every(t => t.posted === 0 && t.transactedAt !== null)).toBe(true);
        });

        it('should post most under the same ID, some under a new one with the tip added, and drop holds', async () => {
            const days = await syncDaily();
            // Everything pending in the first 18 days has posted or gone by the last day.
            const pending = [
                ...byId(
                    days
                        .slice(0, 18)
                        .flat()
                        .filter(t => t.pending)
                ).values()
            ];
            const lastDay = byId(days[20]);
            expect(days[20].some(t => pending.some(p => p.id === t.id && t.pending))).toBe(false);

            const sameId = pending.filter(t => lastDay.has(t.id));
            expect(sameId.length).toBeGreaterThan(pending.length / 2);
            for (const transaction of sameId) {
                expect(lastDay.get(transaction.id)!.amount).toBe(transaction.amount);
            }

            const gone = pending.filter(t => !lastDay.has(t.id));
            const holds = gone.filter(t => t.description.endsWith('PRE-AUTH'));
            const renamed = gone.filter(t => !t.description.endsWith('PRE-AUTH'));
            expect(holds.length).toBeGreaterThan(0);
            expect(holds.every(t => t.amount === -1)).toBe(true);
            expect(renamed.length).toBeGreaterThan(0);
            for (const transaction of renamed) {
                const posted = days[20].find(
                    t => t.transactedAt === transaction.transactedAt && t.payee === transaction.payee
                )!;
                expect(posted.id).not.toBe(transaction.id);
                expect(posted.amount).toBeLessThanOrEqual(transaction.amount);
            }
            // A restaurant's tip.
            expect(
                renamed.some(t => days[20].some(p => p.transactedAt === t.transactedAt && p.amount < t.amount))
            ).toBe(true);
        });

        it('should leave pending transactions out of the balance and in the available balance', async () => {
            const { fetch } = await connect('pending');
            const visa = account(await fetch(), fakeAccountIds.visa);
            const pending = visa.transactions.filter(t => t.pending).reduce((sum, t) => sum + t.amount, 0);

            expect(pending).toBeLessThan(0);
            expect(visa.availableBalance! - visa.balance).toBeCloseTo(pending, 2);
        });

        it('should send no pending transactions unless asked for them', async () => {
            const { accessUrl } = await connect('pending');
            const response = await rawFetch(
                accessUrl,
                `version=2&start-date=${Math.floor(windowStart().getTime() / 1000)}`
            );

            const set = parseAccountSet(await response.json())!;
            expect(set.accounts.flatMap(a => a.transactions).some(t => t.pending)).toBe(false);
        });
    });

    it('SYNC-5.1 should report a connection that needs signing in again for fake:attention', async () => {
        const set = await (await connect('attention')).fetch();

        expect(set.messages).toEqual([
            expect.objectContaining({
                code: 'con.auth',
                connectionId: 'CON-SUMMIT',
                text: expect.stringContaining('sign in again')
            })
        ]);
    });

    it('SYNC-5.1 should pass on a quota warning for fake:warning', async () => {
        const set = await (await connect('warning')).fetch();

        expect(set.messages).toEqual([expect.objectContaining({ code: 'gen.api', connectionId: null })]);
    });

    it.each([
        ['refused', 'refused'],
        ['payment', 'payment-required'],
        ['down', 'timeout']
    ])('SYNC-1.3 should fail fetches for fake:%s as %s', async (scenario, kind) => {
        const { fetch } = await connect(scenario);

        expect((await failure(fetch())).kind).toBe(kind);
    });

    it('SYNC-1.1 should claim fake and fake:<scenario> tokens any number of times, and refuse unknown ones', async () => {
        const client = new FakeSimplefinClient();

        expect(await client.claim(' fake ')).toMatch(
            /^https:\/\/healthy:\d+@fake-bridge\.simplefin\.invalid\/simplefin$/
        );
        expect(await client.claim('fake:pending')).toMatch(/^https:\/\/pending:/);
        expect(await client.claim('fake:pending')).toMatch(/^https:\/\/pending:/);
        for (const token of ['fake:nonsense', 'fakeish', 'fake:', 'real-token']) {
            expect((await failure(client.claim(token))).kind).toBe('invalid-setup-token');
        }
    });

    it('SYNC-1.3 should refuse an access URL with credentials the fake didn’t give', async () => {
        const client = new FakeSimplefinClient();

        const error = await failure(
            client.fetchAccounts('https://nobody:1@fake-bridge.simplefin.invalid/simplefin', windowStart())
        );

        expect(error.kind).toBe('refused');
    });
});

describe('DevelopmentSimplefinClient', () => {
    function stubReal(): jest.Mocked<ISimplefinClient> {
        return {
            claim: jest.fn(async (_token: string) => 'https://u:p@bridge.example/simplefin'),
            fetchAccounts: jest.fn()
        };
    }

    it('should send fake setup tokens and their access URLs to the fake, and the rest to Bridge', async () => {
        const real = stubReal();
        real.fetchAccounts.mockResolvedValue({ connections: [], accounts: [], messages: [] });
        const client = new DevelopmentSimplefinClient(real);

        const fakeUrl = await client.claim('fake:warning');
        const fakeSet = await client.fetchAccounts(fakeUrl, windowStart());
        const realUrl = await client.claim('aHR0cHM6Ly9icmlkZ2UuZXhhbXBsZS9jbGFpbS9Y');
        const realSet = await client.fetchAccounts(realUrl, windowStart());

        expect(fakeSet.accounts.length).toBeGreaterThan(0);
        expect(real.claim).toHaveBeenCalledTimes(1);
        expect(real.claim).toHaveBeenCalledWith('aHR0cHM6Ly9icmlkZ2UuZXhhbXBsZS9jbGFpbS9Y');
        expect(real.fetchAccounts).toHaveBeenCalledTimes(1);
        expect(real.fetchAccounts).toHaveBeenCalledWith('https://u:p@bridge.example/simplefin', expect.any(Date));
        expect(realSet.accounts).toEqual([]);
    });

    it('should refuse a fake token with an unknown scenario rather than send it to Bridge', async () => {
        const real = stubReal();

        expect((await failure(new DevelopmentSimplefinClient(real).claim('fake:typo'))).kind).toBe(
            'invalid-setup-token'
        );
        expect(real.claim).not.toHaveBeenCalled();
    });
});

describe('simplefinClientFromEnvironment', () => {
    it('should use Bridge unless SIMPLEFIN_FAKE is true', () => {
        for (const value of [undefined, '', 'false', ' FALSE ']) {
            expect(simplefinClientFromEnvironment({ SIMPLEFIN_FAKE: value }).usesFake).toBe(false);
        }
        const development = simplefinClientFromEnvironment({ SIMPLEFIN_FAKE: 'true', NODE_ENV: 'development' });
        expect(development.usesFake).toBe(true);
        expect(development.client).toBeInstanceOf(DevelopmentSimplefinClient);
    });

    it('should refuse to start with the fake on in production', () => {
        expect(() => simplefinClientFromEnvironment({ SIMPLEFIN_FAKE: 'true', NODE_ENV: 'production' })).toThrow(
            /SIMPLEFIN_FAKE is for development only/
        );
        expect(simplefinClientFromEnvironment({ SIMPLEFIN_FAKE: 'false', NODE_ENV: 'production' }).usesFake).toBe(
            false
        );
    });

    it('should refuse a value that is neither true nor false, naming the variable', () => {
        expect(() => simplefinClientFromEnvironment({ SIMPLEFIN_FAKE: 'yes' })).toThrow(
            /SIMPLEFIN_FAKE must be true or false/
        );
    });
});
