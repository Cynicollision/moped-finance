import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { BankAccountLinkDefaults, BankAccountResult, BankSyncWording } from '@shared/finance/contracts';
import { BankAccountAction, SyncTrigger } from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { EntityFactory } from '@server/data';
import { OperationResult, Result } from '@server/routing';
import { DateTimeUtil, SecretBox } from '@server/utility';
import { IAccountData } from './../accounts/account-data';
import { IBankAccountLinkData, NewLinkedAccount } from './bank-account-link-data';
import { ISimplefinClient, SimplefinError } from './simplefin-client';
import { ISimplefinData } from './simplefin-data';
import { BankAccountInput, ConnectInput } from './simplefin-schema';
import { SyncQuota } from './sync-quota';
import { SyncOutcome, SyncRunner } from './sync-runner';
import { SyncTransform } from './sync-transform';

/** How many runs Bank Sync lists (SYNC-3.7). */
const runsListed = 10;

export const BankSyncMessages = {
    noKey: BankSyncWording.noKey,
    notConnected: "Bank sync isn't connected.",
    running: 'A sync is already running.',
    tokenRefused:
        "SimpleFIN Bridge didn't accept this setup token. It may have been used already: if you didn't use it, disable it in Bridge, since someone else may have claimed it.",
    tokenInvalid: "That isn't a SimpleFIN setup token. Copy the whole token from SimpleFIN Bridge and paste it here.",
    claimFailed: "SimpleFIN Bridge couldn't be reached to claim the setup token. Try again in a few minutes.",
    paused: BankSyncWording.paused,
    bankAccountNotFound: 'Bank account not found.',
    accountNotFound: 'Account not found.',
    accountClosed: 'Reopen this account to link it.',
    notUsd: BankSyncWording.notUsd,
    bankAccountLinked: BankSyncWording.bankAccountLinked,
    accountLinked: BankSyncWording.accountLinked,
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
        private readonly secretBox: SecretBox | undefined,
        private readonly linkData: IBankAccountLinkData,
        private readonly accountData: IAccountData
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

    /**
     * Link to an account, Create new account, Don't sync or Unlink (SYNC-2), from the bank accounts and transactions
     * the latest sync returned, without asking the SimpleFIN server (SYNC-2.10).
     */
    public async updateBankAccount(id: string, input: BankAccountInput): Promise<OperationResult<BankAccountResult>> {
        const bankAccount = await this.data.retrieveBankAccount(id);
        if (!bankAccount) {
            return Result.userErrorNotFound(BankSyncMessages.bankAccountNotFound);
        }

        let transactionsAdded = 0;
        switch (input.action) {
            case BankAccountAction.Ignore:
                await this.linkData.ignore(id);
                break;
            case BankAccountAction.Unlink:
                await this.linkData.unlink(id);
                break;
            case BankAccountAction.Link:
            case BankAccountAction.Create: {
                const refusal = await this.refuseLink(bankAccount);
                if (refusal) {
                    return refusal;
                }
                const added =
                    input.action === BankAccountAction.Link
                        ? await this.link(id, input.accountId, input.syncFrom)
                        : await this.create(id, input);
                if (typeof added !== 'number') {
                    return added;
                }
                transactionsAdded = added;
                break;
            }
        }

        return Result.success({ bankAccount: (await this.data.retrieveBankAccount(id))!, transactionsAdded });
    }

    /** What Link to an account suggests for this account (SYNC-2.4). */
    public async getLinkDefaults(id: string, accountId: string): Promise<OperationResult<BankAccountLinkDefaults>> {
        if (!(await this.data.retrieveBankAccount(id))) {
            return Result.userErrorNotFound(BankSyncMessages.bankAccountNotFound);
        }
        if (!(await this.accountData.retrieveSingle(accountId))) {
            return Result.userError(BankSyncMessages.accountNotFound);
        }
        return Result.success({ syncFrom: await this.defaultSyncFrom(id, accountId) });
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

    /** Why the bank account can't be linked, or have an account created for it, now. */
    private async refuseLink(bankAccount: BankAccount): Promise<OperationResult<BankAccountResult> | null> {
        if (!bankAccount.canLink) {
            return Result.userError(BankSyncMessages.notUsd);
        }
        if (bankAccount.linkedAccount) {
            return Result.userError(BankSyncMessages.bankAccountLinked);
        }
        // A sync writing into accounts at the same time could add a transaction twice.
        if (await this.data.isRunning()) {
            return Result.conflict(BankSyncMessages.running, 'SYNC_RUNNING');
        }
        return null;
    }

    private async link(
        id: string,
        accountId: string,
        syncFrom: CalendarDate | undefined
    ): Promise<number | OperationResult<BankAccountResult>> {
        // Looked up rather than left to the foreign key, since a closed or connected account is refused too.
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userError(BankSyncMessages.accountNotFound);
        }
        if (account.closedOn) {
            return Result.userError(BankSyncMessages.accountClosed);
        }
        if (!account.isManual) {
            return Result.userError(BankSyncMessages.accountLinked);
        }

        const payload = await this.linkData.retrieveLatestPayload(id);
        const from = syncFrom ?? (await this.defaultSyncFrom(id, accountId));
        const added = await this.linkData.link(id, accountId, from, payload);
        return added ?? Result.userError(BankSyncMessages.bankAccountLinked);
    }

    private async create(
        id: string,
        input: Extract<BankAccountInput, { action: BankAccountAction.Create }>
    ): Promise<number | OperationResult<BankAccountResult>> {
        let institution: NewLinkedAccount['institution'] = null;
        let institutionId = input.institutionId;
        if (input.institutionName !== undefined) {
            // A name that's already an institution's is that institution (SYNC-2.3).
            const existing = await this.linkData.retrieveInstitutionByName(input.institutionName);
            if (existing) {
                institutionId = existing.id;
            } else {
                institution = EntityFactory.createInstitution({ name: input.institutionName });
                institutionId = institution.id;
            }
        }

        const account = EntityFactory.createAccount({
            institutionId: institutionId!,
            name: input.name,
            type: input.type,
            isHidden: input.isHidden ?? false
        });
        // A new account takes everything the bank returned (SYNC-2.3).
        const payload = await this.linkData.retrieveLatestPayload(id);
        const syncFrom = (payload && SyncTransform.earliestDate(payload)) ?? DateTimeUtil.today();
        // A missing institution fails the insert's foreign key, which OperationHandler reports as a 400.
        const added = await this.linkData.createAndLink(id, { account, institution }, syncFrom, payload);
        return added ?? Result.userError(BankSyncMessages.bankAccountLinked);
    }

    /**
     * SYNC-2.4: the day after the account's latest transaction, so the synced history starts where the existing one
     * ends; for an account without transactions, the earliest the bank returned; failing both, today.
     */
    private async defaultSyncFrom(id: string, accountId: string): Promise<CalendarDate> {
        const latest = await this.linkData.retrieveLatestTransactionDate(accountId);
        if (latest) {
            return CalendarDateUtil.addDays(latest, 1);
        }
        const payload = await this.linkData.retrieveLatestPayload(id);
        return (payload && SyncTransform.earliestDate(payload)) ?? DateTimeUtil.today();
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
