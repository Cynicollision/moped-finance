import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { NewEntity } from '@shared/core/types';
import { Account } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { InstitutionDialogComponent, InstitutionDialogData } from './../institutions/institution-dialog.component';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

// Add Account (ACCT-1.3), from the Institutions screen or, with ?institutionId=, from an institution's menu.
@Component({
    selector: 'app-finance-add-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, AccountFormComponent, PageHeaderComponent, CardSkeletonComponent, LoadErrorComponent],
    templateUrl: './add-account.component.html',
    styleUrl: './add-account.component.scss'
})
export class FinanceAddAccountComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    private readonly form = viewChild(AccountFormComponent);
    private saved = false;

    readonly institutions = viewResource({
        loader: async () =>
            (await this.financeService.fetchInstitutions()).sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            )
    });
    readonly institutionId = this.route.snapshot.queryParamMap.get('institutionId');
    readonly saving = signal(false);

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async addInstitution() {
        const added = await this.modalService.open<InstitutionDialogComponent, InstitutionDialogData, boolean>(
            InstitutionDialogComponent,
            {}
        );
        if (added) {
            this.institutions.reload();
        }
    }

    async onSave(accountData: Partial<Account>) {
        const newAccount: NewEntity<Account> = {
            institutionId: accountData.institutionId!,
            name: accountData.name!,
            category: accountData.category!,
            group: accountData.group!,
            type: accountData.type!,
            isHidden: accountData.isHidden ?? false,
            isManual: true,
            isRetirement: accountData.isRetirement ?? false,
            hideFromSpending: accountData.hideFromSpending ?? false
        };

        this.saving.set(true);
        const created = await this.financeService.createAccount(newAccount);
        this.saving.set(false);
        if (created) {
            this.saved = true;
            this.notificationService.success('Account added');
            this.router.navigate(['/accounts', created.id]);
        }
    }

    onCancel() {
        this.router.navigate(['/settings/institutions']);
    }
}
