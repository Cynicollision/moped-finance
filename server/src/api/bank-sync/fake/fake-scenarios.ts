/**
 * What the fake Bridge does, chosen by the setup token: `fake` is `healthy`, and `fake:<scenario>` any other. See
 * docs/development.md#bank-sync-in-development.
 */
export const fakeScenarios = [
    /** Every bank account, transactions day by day, no messages. */
    'healthy',
    /** As healthy, but answering in v1 whatever the request asks. */
    'v1',
    /** A few card purchases get a new amount, description and date 2 days after they post (SYNC-4.4). */
    'corrections',
    /** Summit's Share Certificate appears after the first sync (SYNC-2.2, SYNC-5.1). */
    'new-account',
    /** High-Yield Savings stops being returned after the first sync (SYNC-2.9). */
    'missing',
    /** An `errlist` entry asking to sign in to Summit Credit Union again (SYNC-5.1). */
    'attention',
    /** A quota warning from Bridge in `errlist` (SYNC-5.1). */
    'warning',
    /** Fetching answers 403, as for a revoked access URL (SYNC-1.3). */
    'refused',
    /** Fetching answers 402, as when the subscription lapsed (SYNC-1.3). */
    'payment',
    /** Fetching never answers, so the client times out. */
    'down',
    /**
     * Card purchases are pending for 1 to 3 days. Most keep their ID when they post, some (restaurants, with the tip
     * added) get a new one, and fuel pre-authorization holds vanish without posting (SYNC-4.7, SYNC-6).
     */
    'pending'
] as const;

export type FakeScenario = (typeof fakeScenarios)[number];

/** True for a setup token meant for the fake, whether or not its scenario exists. */
export function isFakeSetupToken(setupToken: string): boolean {
    return /^fake(:|$)/.test(setupToken.trim());
}

/** The scenario a fake setup token names, or null for an unknown one. */
export function scenarioFromSetupToken(setupToken: string): FakeScenario | null {
    const match = /^fake(?::([a-z0-9-]+))?$/.exec(setupToken.trim());
    if (!match) {
        return null;
    }
    const scenario = match[1] ?? 'healthy';
    return (fakeScenarios as readonly string[]).includes(scenario) ? (scenario as FakeScenario) : null;
}
