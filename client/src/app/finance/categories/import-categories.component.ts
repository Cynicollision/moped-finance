import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { CategoryImportResult } from '@shared/finance/contracts';
import { CsvImportComponent } from './../../core/import/csv-import.component';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';

const maxNamesShown = 10;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

@Component({
    selector: 'app-import-categories',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCardModule, CsvImportComponent, PageHeaderComponent],
    templateUrl: './import-categories.component.html',
    styleUrl: './import-categories.component.scss'
})
export class ImportCategoriesComponent {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    readonly crumbs: Crumb[] = [
        { label: 'Settings', link: '/settings' },
        { label: 'Categories', link: '/settings/categories' }
    ];

    readonly runImport = (form: FormData, dryRun: boolean) => this.financeService.importCategories(form, dryRun);

    onImported(result: CategoryImportResult) {
        const groups = result.newGroups.length;
        const created = count(result.createdCount, 'category', 'categories');
        this.notificationService.success(
            `Successfully created ${created}${groups ? ` and ${count(groups, 'group', 'groups')}` : ''}.`
        );
        this.router.navigate(['/settings/categories']);
    }

    /** The new groups with their types: "Pets (Expense), Side Income (Income)" (CAT-7.3). */
    groupsText(groups: CategoryImportResult['newGroups']): string {
        return this.listText(groups.map(g => `${g.name} (${g.type.charAt(0).toUpperCase()}${g.type.slice(1)})`));
    }

    /** The first ten names, then "and N more". */
    listText(names: string[]): string {
        const more = names.length > maxNamesShown ? ` and ${names.length - maxNamesShown} more` : '';
        return names.slice(0, maxNamesShown).join(', ') + more;
    }
}
