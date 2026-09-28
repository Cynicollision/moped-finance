import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Account, Institution } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

@Component({
    selector: 'app-edit-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AccountFormComponent,
        PageHeaderComponent
    ],
    templateUrl: './edit-account.component.html',
    styleUrl: './edit-account.component.scss'
})
export class FinanceEditAccountComponent implements OnInit, HasUnsavedChanges {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);
    private financeService = inject(FinanceService);

    private readonly form = viewChild(AccountFormComponent);
    private saved = false;

    private accountId?: string;
    readonly accountData = signal<Account | undefined>(undefined);
    readonly institutions = signal<Institution[]>([]);

    readonly crumbs = computed<Crumb[]>(() => {
        const crumbs: Crumb[] = [{ label: 'Dashboard', link: '/dashboard' }];
        const account = this.accountData();
        if (account) {
            crumbs.push({ label: account.name, link: ['/accounts', account.id] });
        }
        return crumbs;
    });

    async ngOnInit() {
        this.accountId = this.route.snapshot.paramMap.get('accountId') || undefined;
        if (this.accountId) {
            const [data, institutions] = await Promise.all([
                this.financeService.fetchAccount(this.accountId),
                this.financeService.fetchInstitutions()
            ]);
            if (!data) {
                this.router.navigate(['/dashboard']);
            }
            else {
                this.institutions.set((institutions ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
                this.accountData.set(data);
            }
        }
    }

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(updatedData: Partial<Account>) {
        const currentData = this.accountData();
        if (currentData) {
            const updatedAccount: Account = { ...currentData, ...updatedData };
            const result = await this.financeService.saveAccount(updatedAccount);
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
        }
        else {
            this.router.navigate(['/dashboard']);
        }
    }
}
