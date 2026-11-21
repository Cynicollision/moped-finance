import { BANK_SYNC_WINDOW_DAYS } from '@shared/finance/contracts';
import { BankSyncPauseReason, SyncRunStatus, SyncTrigger } from '@shared/finance/enum';
import { SyncRun } from '@shared/finance/types';
import { DateTimeUtil, SecretBox, SecretBoxError } from '@server/utility';
import { ISimplefinClient, SimplefinError } from './simplefin-client';
import { ISimplefinData, SyncRunResult } from './simplefin-data';
import { SimplefinAccountSet } from './simplefin-response';
import { SyncQuota } from './sync-quota';

const dayMs = 24 * 60 * 60_000;

/** What `SyncRunner.run` did. Only `ran` recorded a run; the rest refused before starting one. */
export type SyncOutcome =
    | { kind: 'ran'; run: SyncRun }
    | { kind: 'no-key' }
    | { kind: 'not-connected' }
    | { kind: 'paused'; reason: BankSyncPauseReason }
    | { kind: 'running' }
    | { kind: 'over-limit'; availableAt: Date };

/**
 * One sync (M02-design.md's pipeline): lock, check the limit, open the access URL, ask Bridge for the last 44 days
 * with pending transactions, and store the payload and the bank accounts. It writes nothing to `finance` yet.
 */
export class SyncRunner {
    private readonly quota: SyncQuota;

    constructor(
        private readonly data: ISimplefinData,
        private readonly client: ISimplefinClient,
        private readonly secretBox: SecretBox | undefined
    ) {
        this.quota = new SyncQuota(data);
    }

    public async run(trigger: SyncTrigger): Promise<SyncOutcome> {
        if (!this.secretBox) {
            return { kind: 'no-key' };
        }
        const access = await this.data.retrieveAccess();
        if (!access) {
            return { kind: 'not-connected' };
        }
        // After a 402, a sync the user starts is how they Try again (SYNC-1.3); the schedule waits for them.
        const reason = access.pausedReason;
        if (reason && !(reason === BankSyncPauseReason.Payment && trigger === SyncTrigger.Manual)) {
            return { kind: 'paused', reason };
        }

        const run = await this.data.startRun(trigger);
        if (!run) {
            return { kind: 'running' };
        }

        let done = false;
        const finish = async (result: SyncRunResult) => {
            const finished = await this.data.finishRun(run.id, result);
            done = true;
            return { kind: 'ran', run: finished } as const;
        };

        try {
            const quota = await this.quota.check();
            if (quota.remaining === 0) {
                if (trigger === SyncTrigger.Scheduled) {
                    return await finish({
                        status: SyncRunStatus.Skipped,
                        failure: 'Skipped: bank sync had reached its limit for the last 24 hours.'
                    });
                }
                await this.data.deleteRun(run.id);
                done = true;
                return { kind: 'over-limit', availableAt: quota.availableAt! };
            }

            let accessUrl: string;
            try {
                accessUrl = this.secretBox.open(access.sealedAccessUrl);
            } catch (error) {
                if (!(error instanceof SecretBoxError)) {
                    throw error;
                }
                await this.data.setPausedReason(BankSyncPauseReason.Undecryptable);
                return await finish({
                    status: SyncRunStatus.Failed,
                    failure: "The stored connection can't be decrypted: ENCRYPTION_KEY has changed."
                });
            }

            await this.data.markRequested(run.id);
            const startDate = DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -BANK_SYNC_WINDOW_DAYS * dayMs);
            let accountSet: SimplefinAccountSet;
            try {
                accountSet = await this.client.fetchAccounts(accessUrl, startDate);
            } catch (error) {
                if (!(error instanceof SimplefinError)) {
                    throw error;
                }
                if (error.kind === 'refused') {
                    await this.data.setPausedReason(BankSyncPauseReason.Refused);
                } else if (error.kind === 'payment-required') {
                    await this.data.setPausedReason(BankSyncPauseReason.Payment);
                }
                // The error's message never holds the URL, a token or a body, so it can be stored as it is.
                return await finish({ status: SyncRunStatus.Failed, failure: error.message, messages: error.messages });
            }

            await this.data.applyAccountSet(accountSet);
            if (reason) {
                await this.data.setPausedReason(null);
            }
            return await finish({
                status: SyncRunStatus.Succeeded,
                messages: accountSet.messages,
                response: accountSet
            });
        } finally {
            // Anything thrown above (the database failing) still frees the lock for the next sync. If this fails too, the
            // error above is the one to report, and the next start fails the run (failInterruptedRuns).
            if (!done) {
                await this.data
                    .finishRun(run.id, {
                        status: SyncRunStatus.Failed,
                        failure: 'An unexpected error stopped this sync.'
                    })
                    .catch(() => undefined);
            }
        }
    }
}
