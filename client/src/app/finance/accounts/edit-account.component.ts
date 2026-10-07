import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountRequest } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

@Component({
    selector: 'app-edit-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AccountFormComponent, CardSkeletonComponent, LoadErrorComponent, PageHeaderComponent],
    templateUrl: './edit-account.component.html',
    styleUrl: './edit-account.component.scss'
})
export class FinanceEditAccountComponent implements HasUnsavedChanges {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);
    private financeService = inject(FinanceService);

    private readonly form = viewChild(AccountFormComponent);
    private saved = false;

    private readonly accountId = this.route.snapshot.paramMap.get('accountId') ?? undefined;
    readonly saving = signal(false);

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
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(changes: AccountRequest) {
        const currentData = this.accountData();
        if (currentData) {
            this.saving.set(true);
            const result = await this.financeService.saveAccount(currentData.id, changes);
            this.saving.set(false);
            if (result) {
                this.saved = true;
                this.notificationService.success('Account saved');
                this.router.navigate(['/accounts', currentData.id]);
            }
        }
    }

    onCancel() {
        const currentData = this.accountData();
        if (currentData) {
            this.router.navigate(['/accounts', currentData.id]);
        } else {
            this.router.navigate(['/dashboard']);
        }
    }
}
