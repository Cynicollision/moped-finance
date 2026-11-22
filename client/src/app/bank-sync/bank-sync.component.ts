import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BankSyncWording } from '@shared/finance/contracts';
import {
    BankAccountAction,
    BankAccountLinkStatus,
    BankSyncPauseReason,
    SyncRunStatus,
    SyncTrigger
} from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { MoneyComponent } from './../common/money.component';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { ListColumn, ListModule } from './../core/list/list.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { BankAccountSetupDialogComponent, BankAccountSetupDialogData } from './bank-account-setup-dialog.component';
import { BankSyncService } from './bank-sync.service';
import { unlinkMessage } from './bank-sync-wording';
import { SetupTokenFormComponent } from './setup-token-form.component';

interface BankSyncView {
    status: BankSyncStatus;
    /** Empty while not connected. */
    accounts: BankAccount[];
    runs: SyncRun[];
}

/** One connection's bank accounts, Not set up first (SYNC-2.1, SYNC-2.2). */
interface ConnectionGroup {
    id: string;
    name: string;
    accounts: BankAccount[];
}

const triggerLabels: Record<SyncTrigger, string> = {
    [SyncTrigger.Scheduled]: 'Scheduled',
    [SyncTrigger.Manual]: 'On demand',
    [SyncTrigger.Connect]: 'Connecting'
};

const statusLabels: Record<SyncRunStatus, string> = {
    [SyncRunStatus.Running]: 'Running',
    [SyncRunStatus.Succeeded]: 'Succeeded',
    [SyncRunStatus.Failed]: 'Failed',
    [SyncRunStatus.Skipped]: 'Skipped'
};

// The Bank Sync page of Settings (SYNC-1, SYNC-2, SYNC-3.3, SYNC-3.7): connecting with a setup token, how syncing
// is going, the bank accounts from the latest sync with what each syncs into, and the last syncs.
@Component({
    selector: 'app-bank-sync',
    imports: [
        DatePipe,
        DecimalPipe,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MoneyComponent,
        PageHeaderComponent,
        ListModule,
        CardSkeletonComponent,
        LoadErrorComponent,
        SetupTokenFormComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bank-sync.component.html',
    styleUrl: './bank-sync.component.scss'
})
export class BankSyncComponent {
    private bankSyncService = inject(BankSyncService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    readonly BankAccountAction = BankAccountAction;
    readonly BankAccountLinkStatus = BankAccountLinkStatus;
    readonly SyncRunStatus = SyncRunStatus;
    readonly BankSyncPauseReason = BankSyncPauseReason;
    readonly wording = BankSyncWording;

    readonly data = viewResource({ loader: () => this.load() });

    /** Sync now or Try again is waiting for the server. */
    readonly syncing = signal(false);
    /** Connect again's setup token field is open in the pause notice. */
    readonly reconnecting = signal(false);
    /** The bank account whose Don't sync or Unlink is waiting for the server. */
    readonly updatingId = signal<string | null>(null);

    readonly status = computed(() => this.data.value()?.status);
    readonly runs = computed(() => this.data.value()?.runs ?? []);

    readonly connectionGroups = computed<ConnectionGroup[]>(() => {
        const groups = new Map<string, ConnectionGroup>();
        // The server lists them by connection name, then name; within a connection, Not set up goes first.
        for (const account of this.data.value()?.accounts ?? []) {
            let group = groups.get(account.connectionId);
            if (!group) {
                group = { id: account.connectionId, name: account.connectionName, accounts: [] };
                groups.set(account.connectionId, group);
            }
            group.accounts.push(account);
        }
        const notSetUpFirst = (a: BankAccount) => (a.linkStatus === BankAccountLinkStatus.NotSetUp ? 0 : 1);
        return [...groups.values()].map(group => ({
            ...group,
            accounts: [...group.accounts].sort((a, b) => notSetUpFirst(a) - notSetUpFirst(b))
        }));
    });

    readonly notSetUpCount = computed(
        () =>
            (this.data.value()?.accounts ?? []).filter(
                a => a.linkStatus === BankAccountLinkStatus.NotSetUp && a.canLink
            ).length
    );

    /** Sync now is disabled while a sync runs, while paused, and at the limit (SYNC-3.3). */
    readonly canSync = computed(() => {
        const status = this.status();
        return (
            !!status &&
            status.connected &&
            !status.pausedReason &&
            !status.isRunning &&
            status.quota.remaining > 0 &&
            !this.syncing()
        );
    });

    readonly accountColumns: ListColumn[] = [
        { key: 'name', label: 'Bank account', width: 'minmax(0, 2fr)', compact: 'primary' },
        { key: 'link', label: 'Syncs into', width: 'minmax(0, 2fr)', compact: 'secondary' },
        { key: 'balance', label: 'Balance', width: '10rem', align: 'end', compact: 'trailing' },
        // Set up and the ⋮ menu (SYNC-2.1); on phones they sit after the balance.
        { key: 'actions', label: '', width: '9rem', align: 'end', compact: 'trailing' }
    ];

    readonly runColumns: ListColumn[] = [
        { key: 'started', label: 'Started', width: '12rem', compact: 'primary' },
        { key: 'trigger', label: 'How', width: '8rem', compact: 'secondary' },
        { key: 'result', label: 'Result', width: 'minmax(0, 1fr)', compact: 'secondary' },
        { key: 'added', label: 'Transactions', width: '8rem', align: 'end', compact: 'trailing' }
    ];

    triggerLabel(run: SyncRun): string {
        return triggerLabels[run.trigger];
    }

    statusLabel(run: SyncRun): string {
        return statusLabels[run.status];
    }

    async syncNow(): Promise<void> {
        this.syncing.set(true);
        const run = await this.bankSyncService.sync();
        this.syncing.set(false);
        if (run) {
            if (run.status === SyncRunStatus.Succeeded) {
                this.notificationService.success(this.describeAdded(run));
            } else {
                this.notificationService.error(run.failure ?? 'The sync failed.');
            }
        }
        this.data.reload();
    }

    onConnected(status: BankSyncStatus): void {
        this.reconnecting.set(false);
        const run = status.lastRun;
        if (run && run.status !== SyncRunStatus.Succeeded) {
            // The connection is stored either way; the status card says what went wrong.
            this.notificationService.error(
                `Bank sync connected, but its first sync failed. ${run.failure ?? ''}`.trim()
            );
        } else {
            this.notificationService.success('Bank sync connected');
        }
        this.data.reload();
    }

    /** SYNC-1.4. */
    async disconnect(): Promise<void> {
        const linked = (this.data.value()?.accounts ?? []).filter(
            a => a.linkStatus === BankAccountLinkStatus.Linked
        ).length;
        const confirmed = await this.modalService.confirm({
            title: 'Disconnect bank sync',
            message: disconnectMessage(linked),
            confirmLabel: 'Disconnect',
            isWarn: true
        });
        if (confirmed && (await this.bankSyncService.disconnect())) {
            this.notificationService.success('Bank sync disconnected');
            this.reconnecting.set(false);
            this.data.reload();
        }
    }

    /** Set up (no choice yet), or Link to an account or Create new account from a row's menu (SYNC-2.1). */
    async setUp(bankAccount: BankAccount, choice?: BankAccountAction.Link | BankAccountAction.Create): Promise<void> {
        const changed = await this.modalService.open<
            BankAccountSetupDialogComponent,
            BankAccountSetupDialogData,
            boolean
        >(BankAccountSetupDialogComponent, { bankAccount, choice });
        if (changed) {
            this.data.reload();
        }
    }

    /**
     * Don't sync, straight away (SYNC-2.2). A linked bank account is unlinked first, so that asks as Unlink does
     * (SYNC-2.7).
     */
    async dontSync(bankAccount: BankAccount): Promise<void> {
        if (bankAccount.linkedAccount && !(await this.confirmUnlink(bankAccount.linkedAccount.name))) {
            return;
        }
        await this.update(bankAccount, BankAccountAction.Ignore, "Bank account set to Don't sync");
    }

    /** SYNC-2.7. */
    async unlink(bankAccount: BankAccount): Promise<void> {
        if (!bankAccount.linkedAccount || !(await this.confirmUnlink(bankAccount.linkedAccount.name))) {
            return;
        }
        await this.update(bankAccount, BankAccountAction.Unlink, 'Account unlinked');
    }

    private async confirmUnlink(accountName: string): Promise<boolean> {
        const confirmed = await this.modalService.confirm({
            title: 'Unlink Account',
            message: unlinkMessage(accountName),
            confirmLabel: 'Unlink'
        });
        return confirmed === true;
    }

    private async update(
        bankAccount: BankAccount,
        action: BankAccountAction.Ignore | BankAccountAction.Unlink,
        done: string
    ): Promise<void> {
        this.updatingId.set(bankAccount.id);
        const result = await this.bankSyncService.updateBankAccount(bankAccount.id, { action });
        this.updatingId.set(null);
        if (result) {
            this.notificationService.success(done);
            this.data.reload();
        }
    }

    private describeAdded(run: SyncRun): string {
        const added = run.transactionsAdded;
        return `Sync finished: ${added} ${added === 1 ? 'transaction' : 'transactions'} added`;
    }

    private async load(): Promise<BankSyncView> {
        const status = await this.bankSyncService.fetchStatus();
        if (!status.connected) {
            return { status, accounts: [], runs: [] };
        }
        const [accounts, runs] = await Promise.all([
            this.bankSyncService.fetchAccounts(),
            this.bankSyncService.fetchRuns()
        ]);
        return { status, accounts, runs };
    }
}

/** SYNC-1.4's confirmation, which names how many accounts become manual. */
export function disconnectMessage(linked: number): string {
    if (linked === 0) {
        return 'Disconnect bank sync? No accounts are synced yet, so nothing else changes.';
    }
    if (linked === 1) {
        return 'Disconnect bank sync? Your 1 synced account becomes manual and keeps its history.';
    }
    return `Disconnect bank sync? Your ${linked} synced accounts become manual and keep their history.`;
}
