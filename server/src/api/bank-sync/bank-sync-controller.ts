import { BankSyncPauseReason, SyncTrigger } from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { OperationResult, Result } from '@server/routing';
import { DateTimeUtil, SecretBox } from '@server/utility';
import { ISimplefinClient, SimplefinError } from './simplefin-client';
import { ISimplefinData } from './simplefin-data';
import { ConnectInput } from './simplefin-schema';
import { SyncQuota } from './sync-quota';
import { SyncOutcome, SyncRunner } from './sync-runner';

/** How many runs Bank Sync lists (SYNC-3.7). */
const runsListed = 10;

export const BankSyncMessages = {
    noKey: 'Bank sync needs an encryption key. Set ENCRYPTION_KEY on the server and restart it.',
    notConnected: "Bank sync isn't connected.",
    running: 'A sync is already running.',
    tokenRefused:
        "SimpleFIN Bridge didn't accept this setup token. It may have been used already: if you didn't use it, disable it in Bridge, since someone else may have claimed it.",
    tokenInvalid: "That isn't a SimpleFIN setup token. Copy the whole token from SimpleFIN Bridge and paste it here.",
    claimFailed: "SimpleFIN Bridge couldn't be reached to claim the setup token. Try again in a few minutes.",
    paused: {
        [BankSyncPauseReason.Refused]:
            'Syncing is paused because SimpleFIN Bridge refused the connection. Connect again with a new setup token.',
        [BankSyncPauseReason.Payment]:
            "SimpleFIN Bridge says your subscription needs payment. Once it's paid, choose Try again.",
        [BankSyncPauseReason.Undecryptable]:
            "Syncing is paused because the stored connection can't be decrypted: ENCRYPTION_KEY has changed. Connect again with a new setup token."
    } satisfies Record<BankSyncPauseReason, string>,
    overLimit: (availableAt: Date) =>
        `Bank sync has reached its limit for today. Available again at ${formatTime(availableAt)}.`
};

/** A time of day in the server's time zone (APP-5.6), as "3:17 PM". */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export class BankSyncController {
    private readonly runner: SyncRunner;
    private readonly quota: SyncQuota;

    constructor(
        private readonly data: ISimplefinData,
        private readonly client: ISimplefinClient,
        private readonly secretBox: SecretBox | undefined
    ) {
        this.runner = new SyncRunner(data, client, secretBox);
        this.quota = new SyncQuota(data);
    }

    public async getStatus(): Promise<OperationResult<BankSyncStatus>> {
        return Result.success(await this.status());
    }

    /** SYNC-1.1, and Connect again (SYNC-1.3): claims the token, stores the access URL sealed, and syncs. */
    public async connect(input: ConnectInput): Promise<OperationResult<BankSyncStatus>> {
        if (!this.secretBox) {
            return Result.userError(BankSyncMessages.noKey, 'NO_ENCRYPTION_KEY');
        }
        if (await this.data.isRunning()) {
            return Result.conflict(BankSyncMessages.running, 'SYNC_RUNNING');
        }
        // Checked before claiming, so a setup token isn't used up when its first sync couldn't run.
        const quota = await this.quota.check();
        if (quota.remaining === 0) {
            return Result.tooManyRequests(BankSyncMessages.overLimit(quota.availableAt!), 'SYNC_LIMIT');
        }

        let accessUrl: string;
        try {
            accessUrl = await this.client.claim(input.setupToken);
        } catch (error) {
            if (!(error instanceof SimplefinError)) {
                throw error;
            }
            if (error.kind === 'refused') {
                return Result.userError(BankSyncMessages.tokenRefused, 'SETUP_TOKEN_REFUSED');
            }
            if (error.kind === 'invalid-setup-token') {
                return Result.userError(BankSyncMessages.tokenInvalid, 'INVALID_SETUP_TOKEN');
            }
            return Result.userError(BankSyncMessages.claimFailed, 'CLAIM_FAILED');
        }

        await this.data.saveAccess(this.secretBox.seal(accessUrl), DateTimeUtil.now());
        // Its result is the status's last run: a failed first sync still leaves the connection stored.
        await this.runner.run(SyncTrigger.Connect);
        return Result.success(await this.status());
    }

    /** SYNC-1.4. */
    public async disconnect(): Promise<OperationResult<void>> {
        if (await this.data.isRunning()) {
            return Result.conflict(BankSyncMessages.running, 'SYNC_RUNNING');
        }
        if (!(await this.data.disconnect())) {
            return Result.userErrorNotFound(BankSyncMessages.notConnected);
        }
        return Result.successDeleted();
    }

    public async retrieveAccounts(): Promise<OperationResult<BankAccount[]>> {
        return Result.success(await this.data.retrieveBankAccounts());
    }

    /** Sync now, and Try again after a 402 (SYNC-3.3, SYNC-1.3). */
    public async sync(): Promise<OperationResult<SyncRun>> {
        return this.resultOf(await this.runner.run(SyncTrigger.Manual));
    }

    public async retrieveRuns(): Promise<OperationResult<SyncRun[]>> {
        return Result.success(await this.data.retrieveRuns(runsListed));
    }

    private async status(): Promise<BankSyncStatus> {
        const [access, isRunning, lastRun, quota] = await Promise.all([
            this.data.retrieveAccess(),
            this.data.isRunning(),
            this.data.retrieveLastFinishedRun(),
            this.quota.check()
        ]);
        return {
            keyConfigured: this.secretBox !== undefined,
            connected: access !== null,
            connectedAt: access?.claimedAt ?? null,
            pausedReason: access?.pausedReason ?? null,
            isRunning,
            lastRun,
            quota
        };
    }

    private resultOf(outcome: SyncOutcome): OperationResult<SyncRun> {
        switch (outcome.kind) {
            case 'ran':
                return Result.success(outcome.run);
            case 'no-key':
                return Result.userError(BankSyncMessages.noKey, 'NO_ENCRYPTION_KEY');
            case 'not-connected':
                return Result.userError(BankSyncMessages.notConnected, 'NOT_CONNECTED');
            case 'paused':
                return Result.userError(BankSyncMessages.paused[outcome.reason], 'SYNC_PAUSED');
            case 'running':
                return Result.conflict(BankSyncMessages.running, 'SYNC_RUNNING');
            case 'over-limit':
                return Result.tooManyRequests(BankSyncMessages.overLimit(outcome.availableAt), 'SYNC_LIMIT');
        }
    }
}
