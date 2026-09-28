import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { BudgetStreamType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { CalendarPeriod } from '@shared/core/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { ListColumn, ListModule } from './../../core/list/list.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../finance.service';
import { FinanceBudgetFormModalComponent, BudgetFormModalData, confirmDeleteStream } from './budget-form-modal.component';

export interface BudgetTotals {
    monthly: number;
    quarterly: number;
    yearly: number;
}

@Component({
    selector: 'app-finance-budget',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        ListModule,
        MoneyComponent
    ],
    templateUrl: './budget.component.html',
    styleUrl: './budget.component.scss'
})
export class FinanceBudgetComponent {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    readonly BudgetStreamType = BudgetStreamType;
    // Narrow: the name and amount, with the category and recurrence under the name (BUD-1.2).
    readonly columns: ListColumn[] = [
        { key: 'name', label: 'Name', width: 'minmax(0, 1.25fr)', compact: 'primary' },
        { key: 'group', label: 'Group' },
        { key: 'category', label: 'Category', compact: 'secondary' },
        { key: 'amount', label: 'Amount', width: '8rem', align: 'end', compact: 'trailing' },
        { key: 'recurrence', label: 'Recurrence', width: '7rem', compact: 'secondary' },
        { key: 'actions', label: '', width: '48px', align: 'end', compact: 'trailing' }
    ];

    readonly data = viewResource({
        loader: async () => {
            const [categories, groups, budgetStreams] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchCategoryGroups(),
                this.financeService.fetchBudgetStreams()
            ]);
            return { categories, groups, budgetStreams };
        }
    });
    private readonly categories = computed<Category[]>(() => this.data.value()?.categories ?? []);
    private readonly groups = computed<CategoryGroup[]>(() => this.data.value()?.groups ?? []);
    private readonly budgetStreams = computed<BudgetStream[]>(() => this.data.value()?.budgetStreams ?? []);

    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map(this.groups().map(g => [g.id, g])));

    readonly incomeStreams = computed(() => this.streamsOfType(BudgetStreamType.Income));
    readonly expenseStreams = computed(() => this.streamsOfType(BudgetStreamType.Expense));

    readonly incomeTotals = computed(() => this.getTotals(this.incomeStreams()));
    readonly expenseTotals = computed(() => this.getTotals(this.expenseStreams()));

    private streamsOfType(type: BudgetStreamType): BudgetStream[] {
        return this.budgetStreams()
            .filter(s => s.type === type)
            .sort((a, b) => this.compareStreams(a, b));
    }

    private getTotals(streams: BudgetStream[]): BudgetTotals {
        let totalMonthly = 0;

        streams.forEach(s => {
            switch (s.recurrence) {
                case CalendarPeriod.Monthly:
                    totalMonthly += s.amount;
                    break;
                case CalendarPeriod.Quarterly:
                    totalMonthly += s.amount / 3;
                    break;
                case CalendarPeriod.Yearly:
                    totalMonthly += s.amount / 12;
                    break;
            }
        });

        return {
            monthly: totalMonthly,
            quarterly: totalMonthly * 3,
            yearly: totalMonthly * 12
        };
    }

    private compareStreams(a: BudgetStream, b: BudgetStream): number {
        const catA = this.categoryMap().get(a.categoryId);
        const catB = this.categoryMap().get(b.categoryId);

        const groupA = catA ? this.groupMap().get(catA.groupId)?.name || '' : '';
        const groupB = catB ? this.groupMap().get(catB.groupId)?.name || '' : '';

        // Sort by recurrence first: Monthly, Quarterly, Yearly
        const periodOrder: Record<CalendarPeriod, number> = {
            [CalendarPeriod.Monthly]: 1,
            [CalendarPeriod.Quarterly]: 2,
            [CalendarPeriod.Yearly]: 3
        };

        const orderA = periodOrder[a.recurrence] || 99;
        const orderB = periodOrder[b.recurrence] || 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        if (groupA !== groupB) {
            return groupA < groupB ? -1 : 1;
        }

        const nameA = catA?.name || '';
        const nameB = catB?.name || '';

        if (nameA !== nameB) {
            return nameA < nameB ? -1 : 1;
        }

        return 0;
    }

    getCategoryName(id: string) {
        const cat = this.categoryMap().get(id);
        return cat ? `${cat.icon} ${cat.name}` : id;
    }

    getCategoryGroup(id: string) {
        const cat = this.categoryMap().get(id);
        if (!cat) {
            return '';
        }
        const group = this.groupMap().get(cat.groupId);
        return group ? group.name : '';
    }

    async startAdd(type: BudgetStreamType) {
        await this.openStream({ type, categories: this.categories(), groups: this.groups() });
    }

    async startEdit(stream: BudgetStream) {
        await this.openStream({ stream, type: stream.type, categories: this.categories(), groups: this.groups() });
    }

    private async openStream(data: BudgetFormModalData) {
        const changed = await this.modalService.open<FinanceBudgetFormModalComponent, BudgetFormModalData, boolean>(
            FinanceBudgetFormModalComponent, data
        );
        if (changed) {
            this.data.reload();
        }
    }

    async delete(stream: BudgetStream) {
        if (await confirmDeleteStream(this.modalService, stream) && await this.financeService.deleteBudgetStream(stream.id)) {
            this.notificationService.success(`${stream.type === BudgetStreamType.Income ? 'Income' : 'Expense'} deleted`);
            this.data.reload();
        }
    }
}
