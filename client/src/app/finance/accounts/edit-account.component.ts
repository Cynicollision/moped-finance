import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Account } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

@Component({
    selector: 'app-edit-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatIconModule,
        RouterLink,
        AccountFormComponent
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

    async ngOnInit() {
        this.accountId = this.route.snapshot.paramMap.get('accountId') || undefined;
        if (this.accountId) {
            const data = await this.financeService.fetchAccount(this.accountId);
            if (!data) {
                this.router.navigate(['/']); // fallback if not found
            }
            else {
                this.accountData.set(data);
            }
        }
    }

    async onSave(updatedData: Partial<Account>) {
        const currentData = this.accountData();
        if (currentData) {
            const updatedAccount: Account = {
                ...currentData,
                ...updatedData,
                balance: Number(updatedData.balance) || 0
            };
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
                this.router.navigate(['/']); // go back to summary or institutions since account is deleted
            }
        }
    }

    onCancel() {
        const currentData = this.accountData();
        if (currentData) {
            this.router.navigate(['/accounts', currentData.id]);
        }
        else {
            this.router.navigate(['/']);
        }
    }
}
