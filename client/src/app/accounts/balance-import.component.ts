import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute, Router } from '@angular/router';
import { BalanceImportResult } from '@shared/finance/contracts';
import { CsvImportComponent } from './../core/import/csv-import.component';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { viewResource } from './../core/loading/view-resource';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';

@Component({
    selector: 'app-balance-import',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCardModule, CsvImportComponent, PageHeaderComponent],
    templateUrl: './balance-import.component.html',
    styleUrl: './balance-import.component.scss'
})
export class BalanceImportComponent {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    readonly accountId = signal(this.route.snapshot.paramMap.get('accountId') ?? '');
    // Only names the account in the breadcrumb, which says "Account" until then or if it fails.
    private readonly accountData = viewResource({
        params: () => this.accountId() || undefined,
        loader: id => this.financeService.fetchAccount(id)
    });
    readonly account = computed(() => this.accountData.value() ?? null);

    readonly runImport = (form: FormData, dryRun: boolean) =>
        this.financeService.importBalanceHistory(this.accountId(), form, dryRun);

    onImported(result: BalanceImportResult) {
        this.notificationService.success(`Successfully imported ${result.createdCount} records.`);
        this.router.navigate(['/accounts', this.accountId()]);
    }
}
