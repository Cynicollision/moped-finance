import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { BudgetStreamType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { CalendarPeriod } from '@shared/core/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { FinanceBudgetFormModalComponent, BudgetFormModalData } from './budget-form-modal.component';

export interface BudgetTotals {
    monthly: number;
    quarterly: number;
    yearly: number;
}

@Component({
    selector: 'app-finance-budget',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        PageHeaderComponent
    ],
    templateUrl: './budget.component.html',
    styleUrl: './budget.component.scss'
})
export class FinanceBudgetComponent implements OnInit {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);

    readonly BudgetStreamType = BudgetStreamType;
    readonly displayedColumns: string[] = ['name', 'group', 'category', 'amount', 'recurrence', 'actions'];

    private readonly categories = signal<Category[]>([]);
    private readonly groups = signal<CategoryGroup[]>([]);
    private readonly budgetStreams = signal<BudgetStream[]>([]);

    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map(this.groups().map(g => [g.id, g])));

    readonly incomeStreams = computed(() => this.streamsOfType(BudgetStreamType.Income));
    readonly expenseStreams = computed(() => this.streamsOfType(BudgetStreamType.Expense));

    readonly incomeTotals = computed(() => this.getTotals(this.incomeStreams()));
    readonly expenseTotals = computed(() => this.getTotals(this.expenseStreams()));

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const [categories, groups, budgetStreams] = await Promise.all([
            this.financeService.fetchCategories(false),
            this.financeService.fetchCategoryGroups(),
            this.financeService.fetchBudgetStreams()
        ]);

        this.categories.set(categories || []);
        this.groups.set(groups || []);
        this.budgetStreams.set(budgetStreams || []);
    }

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
        const result = await this.modalService.open<FinanceBudgetFormModalComponent, BudgetFormModalData, BudgetStream>(FinanceBudgetFormModalComponent, {
            type,
            categories: this.categories(),
            groups: this.groups()
        });

        if (result) {
            await this.save(result);
        }
    }

    async startEdit(stream: BudgetStream) {
        const result = await this.modalService.open<FinanceBudgetFormModalComponent, BudgetFormModalData, BudgetStream>(FinanceBudgetFormModalComponent, {
            stream,
            type: stream.type,
            categories: this.categories(),
            groups: this.groups()
        });

        if (result) {
            await this.save(result);
        }
    }

    async save(stream: BudgetStream) {
        const result = stream.id
            ? await this.financeService.saveBudgetStream(stream)
            : await this.financeService.createBudgetStream(stream);
        if (result) {
            await this.loadData();
        }
    }

    async delete(id: string) {
        const confirmed = await this.modalService.confirm({
            title: 'Delete Budget Stream',
            message: 'Are you sure you want to delete this budget stream? This action cannot be undone.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmed) {
            const success = await this.financeService.deleteBudgetStream(id);
            if (success) {
                await this.loadData();
            }
        }
    }
}
