import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Account, Institution } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

@Component({
    selector: 'app-edit-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatIconModule,
        AccountFormComponent,
        PageHeaderComponent
    ],
    templateUrl: './edit-account.component.html',
    styleUrl: './edit-account.component.scss'
})
export class FinanceEditAccountComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private modalService = inject(ModalService);
    private financeService = inject(FinanceService);

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

    async onSave(updatedData: Partial<Account>) {
        const currentData = this.accountData();
        if (currentData) {
            const updatedAccount: Account = { ...currentData, ...updatedData };
            const result = await this.financeService.saveAccount(updatedAccount);
            if (result) {
                this.router.navigate(['/accounts', currentData.id]);
            }
        }
    }

    async onDelete() {
        const currentData = this.accountData();
        if (!currentData) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Delete Account',
            message: 'Are you sure you want to delete this account? This action cannot be undone.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmed) {
            const success = await this.financeService.deleteAccount(currentData.id);
            if (success) {
                this.router.navigate(['/dashboard']);
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
