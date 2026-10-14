/** The rules for splitting a transaction into parts (TXN-4). */
export const TransactionSplit = {
    minParts: 2,
    maxParts: 20,

    /** What's left of the total once the parts' amounts are taken off, to the cent. 0 when they add up (TXN-4.2). */
    remainder(total: number, partAmounts: number[]): number {
        const cents = partAmounts.reduce((sum, amount) => sum - Math.round(amount * 100), Math.round(total * 100));
        return cents / 100;
    }
} as const;
