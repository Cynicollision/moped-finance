import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BankAccountAction, BankAccountLinkStatus } from '@shared/finance/enum';
import { Account, AccountRequest, BankAccount } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { FinanceService } from './../common/finance.service';
import { BankSyncService } from './../bank-sync/bank-sync.service';
import { unlinkMessage } from './../bank-sync/bank-sync-wording';
import {
    LinkBankAccountDialogComponent,
    LinkBankAccountDialogData
} from './../bank-sync/link-bank-account-dialog.component';
import { AccountFormComponent } from './account-form.component';
import { CloseAccountDialogComponent, CloseAccountDialogData } from './close-account-dialog.component';

/**
 * Everything about the account itself, in sections (ACCT-7): Details, the only one that saves, then Bank sync (ACCT-7.3)
 * and Close or delete, whose buttons act straight away after their own confirmation.
 */
@Component({
    selector: 'app-manage-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatButtonModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        RouterLink,
        AccountFormComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        PageHeaderComponent
    ],
    templateUrl: './manage-account.component.html',
    styleUrl: './manage-account.component.scss'
})
export class ManageAccountComponent implements HasUnsavedChanges {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private financeService = inject(FinanceService);
    private bankSyncService = inject(BankSyncService);

    private readonly form = viewChild(AccountFormComponent);
    /** Set once Details is saved or the account deleted, so leaving doesn't ask about the form. */
    private leaving = false;

    private readonly accountId = this.route.snapshot.paramMap.get('accountId') ?? undefined;
    readonly saving = signal(false);
    /** The section action that's running, whose button shows a spinner (APP-2.1). */
    readonly running = signal<'unlink' | 'reopen' | 'delete' | null>(null);

    readonly data = viewResource({
        params: () => this.accountId,
        loader: async accountId => {
            const [account, institutions, bankSync] = await Promise.all([
                this.financeService.fetchAccount(accountId),
                this.financeService.fetchInstitutions(),
                this.fetchBankSync()
            ]);
            return {
                account,
                bankSync,
                institutions: institutions.sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                )
            };
        }
    });
    readonly accountData = computed(() => this.data.value()?.account);
    readonly institutions = computed(() => this.data.value()?.institutions ?? []);

    /** Whether bank sync is connected (SYNC-1.1); without it, the Bank sync section points to Bank Sync. */
    readonly bankSyncConnected = computed(() => this.data.value()?.bankSync.connected ?? false);
    /** The bank account this account is linked to, for a connected account (ACCT-7.3). */
    readonly linkedBankAccount = computed(() => {
        const account = this.accountData();
        if (!account || account.isManual) {
            return undefined;
        }
        return this.data.value()?.bankSync.bankAccounts.find(b => b.linkedAccount?.id === account.id);
    });
    /** The bank accounts Link to bank account offers: in US dollars and not linked to another account (SYNC-2.4). */
    readonly linkableBankAccounts = computed(() =>
        (this.data.value()?.bankSync.bankAccounts ?? []).filter(
            b => b.canLink && b.linkStatus !== BankAccountLinkStatus.Linked
        )
    );

    readonly crumbs = computed<Crumb[]>(() => {
        const crumbs: Crumb[] = [{ label: 'Dashboard', link: '/dashboard' }];
        const account = this.accountData();
        if (account) {
            crumbs.push({ label: account.name, link: ['/accounts', account.id] });
        }
        return crumbs;
    });

    hasUnsavedChanges(): boolean {
        return !this.leaving && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(changes: AccountRequest) {
        const account = this.accountData();
        if (!account) {
            return;
        }

        this.saving.set(true);
        const result = await this.financeService.saveAccount(account.id, changes);
        this.saving.set(false);
        if (result) {
            this.leaving = true;
            this.notificationService.success('Account saved');
            this.router.navigate(['/accounts', account.id]);
        }
    }

    onCancel() {
        const account = this.accountData();
        this.router.navigate(account ? ['/accounts', account.id] : ['/dashboard']);
    }

    /** ACCT-7.3. */
    async linkBankAccount() {
        const account = await this.readyToAct();
        if (!account) {
            return;
        }

        const linked = await this.modalService.open<LinkBankAccountDialogComponent, LinkBankAccountDialogData, boolean>(
            LinkBankAccountDialogComponent,
            { account, bankAccounts: this.linkableBankAccounts() }
        );
        if (linked) {
            this.data.reload();
        }
    }

    /** ACCT-4.5. */
    async unlinkBankAccount() {
        const bankAccount = this.linkedBankAccount();
        const account = bankAccount && (await this.readyToAct());
        if (!bankAccount || !account) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Unlink Account',
            message: unlinkMessage(account.name),
            confirmLabel: 'Unlink'
        });
        if (!confirmed) {
            return;
        }

        this.running.set('unlink');
        const result = await this.bankSyncService.updateBankAccount(bankAccount.id, {
            action: BankAccountAction.Unlink
        });
        this.running.set(null);
        if (result) {
            this.notificationService.success('Account unlinked');
            this.data.reload();
        }
    }

    async closeAccount() {
        const account = await this.readyToAct();
        if (!account) {
            return;
        }

        const closed = await this.modalService.open<CloseAccountDialogComponent, CloseAccountDialogData, boolean>(
            CloseAccountDialogComponent,
            { account }
        );
        if (closed) {
            this.data.reload();
        }
    }

    async reopenAccount() {
        const account = await this.readyToAct();
        if (!account) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Reopen Account',
            message: `Reopen ${account.name}? Its balance history stays as it is.`,
            confirmLabel: 'Reopen'
        });
        if (!confirmed) {
            return;
        }

        this.running.set('reopen');
        const reopened = await this.financeService.reopenAccount(account.id);
        this.running.set(null);
        if (reopened) {
            this.notificationService.success('Account reopened');
            this.data.reload();
        }
    }

    async deleteAccount() {
        const account = await this.readyToAct();
        if (!account) {
            return;
        }

        // Closing keeps the account's past in the totals, so an open, unhidden one is pointed there first (ACCT-1.6).
        const keepPast =
            account.closedOn || account.isHidden
                ? ''
                : ' To keep its past in your net worth and Spending, close it instead.';
        const confirmed = await this.modalService.confirm({
            title: 'Delete Account',
            message: `Delete ${account.name}, with its balance history and transactions? This can't be undone.${keepPast}`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (!confirmed) {
            return;
        }

        this.running.set('delete');
        const deleted = await this.financeService.deleteAccount(account.id);
        this.running.set(null);
        if (deleted) {
            this.leaving = true;
            this.notificationService.success('Account deleted');
            this.router.navigate(['/dashboard']);
        }
    }

    /** Bank sync's connection and bank accounts; none while it isn't connected. */
    private async fetchBankSync(): Promise<{ connected: boolean; bankAccounts: BankAccount[] }> {
        const status = await this.bankSyncService.fetchStatus();
        if (!status.keyConfigured || !status.connected) {
            return { connected: false, bankAccounts: [] };
        }
        return { connected: true, bankAccounts: await this.bankSyncService.fetchAccounts() };
    }

    /**
     * The account, once any unsaved changes to Details are discarded (ACCT-7.2, APP-2.7), or undefined if the user
     * keeps editing. Discarding resets the form to the saved account.
     */
    private async readyToAct(): Promise<Account | undefined> {
        const account = this.accountData();
        const form = this.form();
        if (!account || this.running()) {
            return undefined;
        }
        if (form?.hasUnsavedChanges()) {
            if (!(await this.modalService.confirmDiscard())) {
                return undefined;
            }
            form.reset(account);
        }
        return account;
    }
}
