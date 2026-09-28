import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { NewEntity } from '@shared/core/types';
import { Account, Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
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
    imports: [
        MatButtonModule,
        AccountFormComponent,
        PageHeaderComponent
    ],
    templateUrl: './add-account.component.html',
    styleUrl: './add-account.component.scss'
})
export class FinanceAddAccountComponent implements OnInit, HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    private readonly form = viewChild(AccountFormComponent);
    private saved = false;

    readonly institutions = signal<Institution[] | null>(null);
    readonly institutionId = this.route.snapshot.queryParamMap.get('institutionId');

    async ngOnInit() {
        await this.loadInstitutions();
    }

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async addInstitution() {
        const added = await this.modalService.open<InstitutionDialogComponent, InstitutionDialogData, boolean>(InstitutionDialogComponent, {});
        if (added) {
            await this.loadInstitutions();
        }
    }

    private async loadInstitutions() {
        const institutions = await this.financeService.fetchInstitutions() ?? [];
        this.institutions.set(institutions.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
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
            hideFromCashflow: accountData.hideFromCashflow ?? false
        };

        const created = await this.financeService.createAccount(newAccount);
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
