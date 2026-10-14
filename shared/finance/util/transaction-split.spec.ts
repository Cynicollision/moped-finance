import { TransactionSplit } from './transaction-split';

describe('TransactionSplit', () => {
    describe('remainder', () => {
        it('TXN-4.2 should be 0 when the parts add up to the total, to the cent', () => {
            expect(TransactionSplit.remainder(-0.3, [-0.1, -0.2])).toBe(0);
            expect(TransactionSplit.remainder(-100, [-60.01, -39.99])).toBe(0);
        });

        it('TXN-4.2 should be what the parts leave over, signed as the total', () => {
            expect(TransactionSplit.remainder(-100, [-60])).toBe(-40);
            expect(TransactionSplit.remainder(-100, [-120])).toBe(20);
            expect(TransactionSplit.remainder(50, [])).toBe(50);
        });
    });
});
