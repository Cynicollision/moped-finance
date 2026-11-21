import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { DateTimeUtil } from '@server/utility';
import { fakeAccountIds, fakeAccounts, fakeConnections, FakeTransaction, generateFakeTransactions } from './fake-banks';
import { FakeScenario, fakeScenarios } from './fake-scenarios';

/** Can never resolve, so a fake access URL that reaches the real client just fails to connect. */
export const fakeBridgeHost = 'fake-bridge.simplefin.invalid';

/** `fake:new-account` and `fake:missing` change for requests this long after the claim, so after the connecting sync. */
export const fakeChangeDelaySeconds = 60;

const day = 24 * 60 * 60;
const sfinUrl = `https://${fakeBridgeHost}/simplefin`;
const forbidden = { errlist: [{ code: 'gen.auth', msg: 'Forbidden' }], accounts: [], connections: [] };
// Bridge's own words, from the demo token (M02-design.md).
const rangeWarning = 'Requested date range exceeds recommended range of 45 days. In the future, this may be capped.';
const noStartDate = "Provide a 'start-date' parameter to receive transactions prior to yesterday";
// Made up: what Bridge says for these is still to be seen (T10).
const signInAgain = 'Summit Credit Union needs you to sign in again. Visit SimpleFIN Bridge to fix the connection.';
const quotaWarning = 'You have made more requests than expected today. Going further may disable this access token.';

/**
 * A stand-in for SimpleFIN Bridge in development and tests: a `fetch` that answers claims and `GET /accounts` the way
 * Bridge does, for `SimplefinClient` to use in place of the network. Nothing is stored. A fake access URL carries its
 * scenario and the time it was claimed as its credentials, and the payload is worked out from those and the clock
 * (`DateTimeUtil`), so the same day always gives the same answer and tests can move the clock on.
 */
export class FakeBridge {
    public static claimUrl(scenario: FakeScenario): string {
        return `${sfinUrl}/claim/${scenario}`;
    }

    public readonly fetch: typeof fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.host !== fakeBridgeHost) {
            throw new TypeError('fetch failed');
        }

        const claim = /^\/simplefin\/claim\/([a-z0-9-]+)$/.exec(url.pathname);
        if (claim && init?.method === 'POST') {
            const scenario = claim[1];
            if (!(fakeScenarios as readonly string[]).includes(scenario)) {
                return new Response('Forbidden', { status: 403 });
            }
            const claimedAt = Math.floor(DateTimeUtil.now().getTime() / 1000);
            return new Response(`https://${scenario}:${claimedAt}@${fakeBridgeHost}/simplefin`);
        }

        if (url.pathname !== '/simplefin/accounts' || (init?.method ?? 'GET') !== 'GET') {
            return new Response('Not found', { status: 404 });
        }
        const access = readAuthorization(new Headers(init?.headers).get('Authorization'));
        if (!access || access.scenario === 'refused') {
            return Response.json(forbidden, { status: 403 });
        }
        if (access.scenario === 'payment') {
            return new Response('Payment Required', { status: 402 });
        }
        if (access.scenario === 'down') {
            return new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
            });
        }
        return Response.json(buildPayload(access.scenario, access.claimedAt, url.searchParams));
    };
}

function readAuthorization(header: string | null): { scenario: FakeScenario; claimedAt: number } | null {
    const match = /^Basic (.+)$/.exec(header ?? '');
    const [scenario, claimedAt] = match ? Buffer.from(match[1], 'base64').toString('utf8').split(':') : [];
    if (!(fakeScenarios as readonly string[]).includes(scenario) || !/^\d+$/.test(claimedAt ?? '')) {
        return null;
    }
    return { scenario: scenario as FakeScenario, claimedAt: Number(claimedAt) };
}

/** Unix seconds for a time of day on a calendar day, in the server's time zone. */
function timestamp(date: CalendarDate, secondsOfDay: number): number {
    return CalendarDateUtil.toDate(date).getTime() / 1000 + secondsOfDay;
}

const money = (cents: number) => (cents / 100).toFixed(2);

interface PayloadTransaction {
    id: string;
    posted: number;
    amount: string;
    description: string;
    payee: string;
    transacted_at?: number;
    pending?: true;
}

/** How one transaction shows today in a scenario: posted, pending, or not at all (null). */
function showToday(
    transaction: FakeTransaction,
    scenario: FakeScenario,
    today: CalendarDate
): { entry: PayloadTransaction; isPending: boolean; cents: number } | null {
    const slow = scenario === 'pending';
    if (transaction.vanishes && !slow) {
        return null;
    }
    const postsOn = slow ? transaction.postsOnSlowly : transaction.postsOn;
    const correction =
        scenario === 'corrections' && today >= CalendarDateUtil.addDays(postsOn, 2)
            ? transaction.correction
            : undefined;
    const transactedOn = correction?.transactedOn ?? transaction.transactedOn;
    const transactedAt = transaction.hasTransactedAt
        ? { transacted_at: timestamp(transactedOn, transaction.timeOfDay) }
        : {};

    if (postsOn <= today && !transaction.vanishes) {
        const cents = correction?.amountCents ?? transaction.amountCents;
        const postedTime = transaction.hasTransactedAt
            ? 4 * 3600 + (transaction.timeOfDay % 3600)
            : transaction.timeOfDay;
        return {
            isPending: false,
            cents,
            entry: {
                id: transaction.id,
                posted: timestamp(postsOn, postedTime),
                amount: money(cents),
                description: correction?.description ?? transaction.description,
                payee: transaction.payee,
                ...transactedAt
            }
        };
    }
    if (!slow || postsOn <= today) {
        return null;
    }
    const cents = transaction.pending?.amountCents ?? transaction.amountCents;
    return {
        isPending: true,
        cents,
        entry: {
            id: transaction.pending?.id ?? transaction.id,
            posted: 0,
            amount: money(cents),
            description: transaction.description,
            payee: transaction.payee,
            ...transactedAt,
            pending: true
        }
    };
}

/** The body Bridge would send for `GET /accounts` with these parameters, today, in this scenario. */
function buildPayload(scenario: FakeScenario, claimedAt: number, params: URLSearchParams): object {
    const now = Math.floor(DateTimeUtil.now().getTime() / 1000);
    const today = DateTimeUtil.today();
    const afterFirstSync = now >= claimedAt + fakeChangeDelaySeconds;
    const startText = params.get('start-date');
    const start =
        startText && /^\d+$/.test(startText) ? Number(startText) : timestamp(CalendarDateUtil.addDays(today, -1), 0);
    const includePending = params.get('pending') === '1';

    const messages: { code: string; msg: string; conn_id?: string }[] = [];
    if (now - start >= 45 * day) {
        messages.push({ code: 'gen.api', msg: rangeWarning });
    }
    if (scenario === 'attention') {
        messages.push({ code: 'con.auth', msg: signInAgain, conn_id: 'CON-SUMMIT' });
    }
    if (scenario === 'warning') {
        messages.push({ code: 'gen.api', msg: quotaWarning });
    }
    const notes = startText ? [] : [noStartDate];

    const visible = fakeAccounts.filter(
        account =>
            (!account.appearsLater || (scenario === 'new-account' && afterFirstSync)) &&
            !(account.id === fakeAccountIds.savings && scenario === 'missing' && afterFirstSync)
    );
    const transactions = generateFakeTransactions(today);

    const accounts = visible.map(account => {
        let balance = account.openingCents;
        let available = account.openingCents;
        const entries: PayloadTransaction[] = [];
        for (const transaction of transactions.filter(t => t.accountId === account.id)) {
            const shown = showToday(transaction, scenario, today);
            if (!shown) {
                continue;
            }
            available += shown.cents;
            if (shown.isPending) {
                if (includePending && (shown.entry.transacted_at ?? 0) >= start) {
                    entries.push(shown.entry);
                }
            } else {
                balance += shown.cents;
                if (shown.entry.posted >= start) {
                    entries.push(shown.entry);
                }
            }
        }
        return {
            account,
            body: {
                id: account.id,
                name: account.name,
                currency: account.currency,
                balance: money(balance),
                'available-balance': money(available),
                'balance-date': timestamp(today, 4 * 3600),
                transactions: entries,
                holdings: []
            }
        };
    });

    // Bridge answers in v1 unless asked for v2; fake:v1 always does.
    if (scenario === 'v1' || params.get('version') !== '2') {
        return {
            errors: messages.map(message => message.msg),
            accounts: accounts.map(({ account, body }) => {
                const connection = fakeConnections.find(c => c.id === account.connectionId)!;
                return {
                    ...body,
                    org: {
                        domain: connection.orgId,
                        name: connection.name,
                        'sfin-url': sfinUrl,
                        url: connection.orgUrl,
                        id: connection.orgId
                    }
                };
            }),
            ...(notes.length ? { 'x-api-message': notes } : {})
        };
    }
    return {
        errlist: messages,
        connections: fakeConnections.map(connection => ({
            conn_id: connection.id,
            name: connection.name,
            org_id: connection.orgId,
            org_name: connection.name,
            org_url: connection.orgUrl,
            sfin_url: sfinUrl
        })),
        accounts: accounts.map(({ account, body }) => ({ ...body, conn_id: account.connectionId })),
        ...(notes.length ? { 'x-api-message': notes } : {})
    };
}
