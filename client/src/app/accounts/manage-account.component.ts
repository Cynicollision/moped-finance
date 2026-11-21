import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Account, AccountRequest } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { FinanceService } from './../common/finance.service';
import { AccountFormComponent } from './account-form.component';
import { CloseAccountDialogComponent, CloseAccountDialogData } from './close-account-dialog.component';

/**
 * Everything about the account itself, in sections (ACCT-7): Details, the only one that saves, then Close or delete,
 * whose buttons act straight away after their own confirmation. The Bank sync section comes with bank links (ACCT-7.3).
 */
@Component({
    selector: 'app-manage-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatButtonModule,
        MatDividerModule,
        MatProgressSpinnerModule,
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

    private readonly form = viewChild(AccountFormComponent);
    /** Set once Details is saved or the account deleted, so leaving doesn't ask about the form. */
    private leaving = false;

    private readonly accountId = this.route.snapshot.paramMap.get('accountId') ?? undefined;
    readonly saving = signal(false);
    /** The section action that's running, whose button shows a spinner (APP-2.1). */
    readonly running = signal<'reopen' | 'delete' | null>(null);

    readonly data = viewResource({
        params: () => this.accountId,
        loader: async accountId => {
            const [account, institutions] = await Promise.all([
                this.financeService.fetchAccount(accountId),
                this.financeService.fetchInstitutions()
            ]);
            return {
                account,
                institutions: institutions.sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                )
            };
        }
    });
    readonly accountData = computed(() => this.data.value()?.account);
    readonly institutions = computed(() => this.data.value()?.institutions ?? []);

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
