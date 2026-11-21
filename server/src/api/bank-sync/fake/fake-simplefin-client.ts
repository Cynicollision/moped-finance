import { ISimplefinClient, SimplefinClient, SimplefinError } from './../simplefin-client';
import { SimplefinAccountSet } from './../simplefin-response';
import { FakeBridge, fakeBridgeHost } from './fake-bridge';
import { isFakeSetupToken, scenarioFromSetupToken } from './fake-scenarios';

/** Short enough that `fake:down` is quick to try in the app. */
const defaultFakeTimeoutMs = 5_000;

/**
 * Bank sync against the fake Bridge, for development (`SIMPLEFIN_FAKE=true`) and tests. It's the real
 * `SimplefinClient` with `FakeBridge` in place of the network, so every request goes through the real URL handling,
 * header, parsing and errors. Setup tokens are `fake` or `fake:<scenario>` rather than Base64.
 */
export class FakeSimplefinClient implements ISimplefinClient {
    private readonly client: SimplefinClient;

    constructor(options: { timeoutMs?: number } = {}) {
        this.client = new SimplefinClient({
            fetch: new FakeBridge().fetch,
            timeoutMs: options.timeoutMs ?? defaultFakeTimeoutMs
        });
    }

    /** True for an access URL this client claimed. */
    public static isFakeAccessUrl(accessUrl: string): boolean {
        return URL.parse(accessUrl)?.host === fakeBridgeHost;
    }

    public async claim(setupToken: string): Promise<string> {
        const scenario = scenarioFromSetupToken(setupToken);
        if (!scenario) {
            throw new SimplefinError(
                'invalid-setup-token',
                isFakeSetupToken(setupToken)
                    ? 'The fake SimpleFIN Bridge has no such scenario.'
                    : 'The setup token is not one for the fake SimpleFIN Bridge.'
            );
        }
        return this.client.claim(Buffer.from(FakeBridge.claimUrl(scenario)).toString('base64'));
    }

    public fetchAccounts(accessUrl: string, startDate: Date): Promise<SimplefinAccountSet> {
        return this.client.fetchAccounts(accessUrl, startDate);
    }
}

/**
 * Development's client with `SIMPLEFIN_FAKE=true`: fake setup tokens and the access URLs they give go to the fake,
 * and everything else to Bridge, so a demo token still works.
 */
export class DevelopmentSimplefinClient implements ISimplefinClient {
    constructor(
        private readonly real: ISimplefinClient,
        private readonly fake: ISimplefinClient = new FakeSimplefinClient()
    ) {}

    public claim(setupToken: string): Promise<string> {
        return isFakeSetupToken(setupToken) ? this.fake.claim(setupToken) : this.real.claim(setupToken);
    }

    public fetchAccounts(accessUrl: string, startDate: Date): Promise<SimplefinAccountSet> {
        return FakeSimplefinClient.isFakeAccessUrl(accessUrl)
            ? this.fake.fetchAccounts(accessUrl, startDate)
            : this.real.fetchAccounts(accessUrl, startDate);
    }
}
