import { SimplefinAccount, SimplefinTransaction } from './simplefin-response';
import { SyncTransform, unknownMerchant } from './sync-transform';

// The tests run in New York (UTC-5 in November), so these instants fall on different days there and in UTC.
const nov20Evening = Date.parse('2026-11-21T03:00:00Z') / 1000; // Nov 20, 10 PM in New York
const nov21Morning = Date.parse('2026-11-21T15:00:00Z') / 1000;
const nov22Morning = Date.parse('2026-11-22T15:00:00Z') / 1000;

function transaction(fields: Partial<SimplefinTransaction> = {}): SimplefinTransaction {
    return {
        id: 'T1',
        posted: nov21Morning,
        amount: -12.5,
        description: 'DAILY GRIND COFFEE #12',
        payee: 'Daily Grind Coffee',
        memo: null,
        transactedAt: null,
        pending: false,
        ...fields
    };
}

function account(transactions: SimplefinTransaction[]): SimplefinAccount {
    return {
        id: 'A1',
        connectionId: 'C1',
        name: 'Everyday Checking',
        currency: 'USD',
        balance: 100,
        availableBalance: null,
        balanceDate: nov22Morning,
        transactions
    };
}

const everything = { from: null, to: '2026-12-31' };

describe('SyncTransform', () => {
    describe('transactions', () => {
        it('SYNC-4.2 should take the amount as given, the payee as merchant and the description as statement', () => {
            expect(SyncTransform.transactions(account([transaction()]), everything)).toEqual([
                {
                    simplefinId: 'T1',
                    date: '2026-11-21',
                    amount: -12.5,
                    merchant: 'Daily Grind Coffee',
                    originalStatement: 'DAILY GRIND COFFEE #12'
                }
            ]);
        });

        it('SYNC-4.2 should date a transaction on the day it happened, in the server time zone', () => {
            const [synced] = SyncTransform.transactions(
                account([transaction({ transactedAt: nov20Evening, posted: nov22Morning })]),
                everything
            );
            expect(synced.date).toBe('2026-11-20');
        });

        it('SYNC-4.2 should date a transaction on the day it posted when the bank does not say when it happened', () => {
            const [synced] = SyncTransform.transactions(
                account([transaction({ posted: nov20Evening, transactedAt: null })]),
                everything
            );
            expect(synced.date).toBe('2026-11-20');
        });

        it('SYNC-4.2 should use the description as merchant when there is no payee, trimmed and at most 255 long', () => {
            const long = `  ${'A'.repeat(300)}  `;
            const [plain, cut, blank] = SyncTransform.transactions(
                account([
                    transaction({ id: 'T1', payee: null, description: '  POS PURCHASE 1234  ' }),
                    transaction({ id: 'T2', payee: null, description: long }),
                    transaction({ id: 'T3', payee: null, description: '   ' })
                ]),
                everything
            );

            expect(plain.merchant).toBe('POS PURCHASE 1234');
            expect(plain.originalStatement).toBe('  POS PURCHASE 1234  ');
            expect(cut.merchant).toBe('A'.repeat(255));
            expect(blank.merchant).toBe(unknownMerchant);
        });

        it('SYNC-4.2 should round amounts to cents', () => {
            const [synced] = SyncTransform.transactions(account([transaction({ amount: 10.005 })]), everything);
            expect(synced.amount).toBe(10.01);
        });

        it('SYNC-4.7 should leave out pending transactions and any that have not posted', () => {
            const synced = SyncTransform.transactions(
                account([
                    transaction({ id: 'posted' }),
                    transaction({ id: 'pending', pending: true }),
                    transaction({ id: 'unposted', posted: 0 })
                ]),
                everything
            );
            expect(synced.map(t => t.simplefinId)).toEqual(['posted']);
        });

        it('SYNC-2.4 should keep only the days from the Sync transactions from date to the latest date', () => {
            const synced = SyncTransform.transactions(
                account([
                    transaction({ id: 'before', posted: nov20Evening }),
                    transaction({ id: 'first', posted: nov21Morning }),
                    transaction({ id: 'last', posted: nov22Morning }),
                    transaction({ id: 'future', posted: nov22Morning + 24 * 3600 })
                ]),
                { from: '2026-11-21', to: '2026-11-22' }
            );
            expect(synced.map(t => t.simplefinId)).toEqual(['first', 'last']);
        });

        it('should list the transactions oldest first', () => {
            const synced = SyncTransform.transactions(
                account([
                    transaction({ id: 'B', posted: nov22Morning }),
                    transaction({ id: 'C', posted: nov21Morning }),
                    transaction({ id: 'A', posted: nov22Morning })
                ]),
                everything
            );
            expect(synced.map(t => t.simplefinId)).toEqual(['C', 'A', 'B']);
        });
    });

    describe('earliestDate', () => {
        it('SYNC-2.4 should give the earliest posted transaction date, or null', () => {
            expect(
                SyncTransform.earliestDate(
                    account([
                        transaction({ posted: nov22Morning }),
                        transaction({ posted: nov20Evening, pending: true }),
                        transaction({ posted: nov21Morning })
                    ])
                )
            ).toBe('2026-11-21');
            expect(SyncTransform.earliestDate(account([]))).toBeNull();
        });
    });

    describe('backfill', () => {
        it('SYNC-4.6 should work back from the bank balance through each day with transactions', () => {
            expect(
                SyncTransform.backfill(100, '2026-11-22', [
                    { date: '2026-11-18', amount: -10 },
                    { date: '2026-11-20', amount: 50 },
                    { date: '2026-11-20', amount: -5.25 },
                    { date: '2026-11-22', amount: -20 }
                ])
            ).toEqual([
                { date: '2026-11-17', balance: 85.25 },
                { date: '2026-11-18', balance: 75.25 },
                { date: '2026-11-20', balance: 120 },
                { date: '2026-11-22', balance: 100 }
            ]);
        });

        it('SYNC-4.6 should add the bank balance date when it is after the last transaction', () => {
            expect(SyncTransform.backfill(-500, '2026-11-22', [{ date: '2026-11-20', amount: -25 }])).toEqual([
                { date: '2026-11-19', balance: -475 },
                { date: '2026-11-20', balance: -500 },
                { date: '2026-11-22', balance: -500 }
            ]);
        });

        it('SYNC-4.6 should record only the bank balance when there are no transactions', () => {
            expect(SyncTransform.backfill(42, '2026-11-22', [])).toEqual([{ date: '2026-11-22', balance: 42 }]);
        });

        it('SYNC-4.6 should keep cents exact over many amounts', () => {
            const transactions = Array.from({ length: 10 }, () => ({ date: '2026-11-20', amount: 0.1 }));
            expect(SyncTransform.backfill(1, '2026-11-20', transactions)[0]).toEqual({
                date: '2026-11-19',
                balance: 0
            });
        });
    });
});
