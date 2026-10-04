/**
 * A transaction with no category is Uncategorized (CAT-5). It's a state, not a category: it has no group or type, and
 * Spending counts it by sign (CASH-1.3).
 */
export const Uncategorized = {
    /** What the app calls it, and the CategoryName an import maps to it (TXN-3.4). No category can take this name. */
    name: 'Uncategorized',
    /** The Category filter's value for transactions with no category (TXN-1.11). */
    filterValue: 'uncategorized',

    isName(name: string): boolean {
        return name.trim().toLowerCase() === 'uncategorized';
    }
} as const;
