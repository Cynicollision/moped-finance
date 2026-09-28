import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CalendarPeriod } from '@shared/core/enum';
import { BudgetStreamType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { BudgetStreamUtil } from '@shared/finance/util';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { ListColumn, ListModule } from './../../core/list/list.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { MoneyComponent, MoneyTone } from './../common/money.component';
import { FinanceService } from './../finance.service';
import { FinanceBudgetFormModalComponent, BudgetFormModalData, confirmDeleteStream, streamTypeLabel } from './budget-form-modal.component';

/** One of the screen's sections: Income, Expenses or Savings (BUD-1.2). */
export interface BudgetSection {
    type: BudgetStreamType;
    title: string;
    empty: string;
    tone: MoneyTone;
    streams: BudgetStream[];
    /** What the section's streams come to per month (BUD-1.6). */
    monthly: number;
}

const sectionText: Record<BudgetStreamType, Pick<BudgetSection, 'title' | 'empty' | 'tone'>> = {
    [BudgetStreamType.Income]: { title: 'Income', empty: 'No income planned yet.', tone: 'favourable' },
    [BudgetStreamType.Expense]: { title: 'Expenses', empty: 'No expenses planned yet.', tone: 'plain' },
    [BudgetStreamType.Savings]: { title: 'Savings', empty: 'No savings planned yet.', tone: 'favourable' }
};

const recurrenceOrder = [CalendarPeriod.Monthly, CalendarPeriod.Quarterly, CalendarPeriod.Yearly];

@Component({
    selector: 'app-finance-budget',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatButtonToggleModule,
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

    readonly periods = recurrenceOrder;
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
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map(this.groups().map(g => [g.id, g])));

    /** The period every total is shown for (BUD-1.6). */
    readonly period = signal(CalendarPeriod.Monthly);
    private readonly months = computed(() => BudgetStreamUtil.monthsIn(this.period()));

    readonly sections = computed<BudgetSection[]>(() => {
        const streams = this.data.value()?.budgetStreams ?? [];
        return [BudgetStreamType.Income, BudgetStreamType.Expense, BudgetStreamType.Savings].map(type => {
            const ofType = streams.filter(s => s.type === type).sort((a, b) => this.compareStreams(a, b));
            const monthly = ofType.reduce((sum, s) => sum + BudgetStreamUtil.monthlyAmount(s), 0);
            return { type, ...sectionText[type], streams: ofType, monthly };
        });
    });

    /** Income less expenses and savings (BUD-1.10). */
    readonly leftOver = computed(() => {
        const [income, expenses, savings] = this.sections().map(section => section.monthly);
        return this.forPeriod(income - expenses - savings);
    });

    /** A monthly amount over the chosen period. */
    forPeriod(monthly: number): number {
        return monthly * this.months();
    }

    // Monthly, then Quarterly, then Yearly; then by group name and category name (BUD-1.5).
    private compareStreams(a: BudgetStream, b: BudgetStream): number {
        const byRecurrence = recurrenceOrder.indexOf(a.recurrence) - recurrenceOrder.indexOf(b.recurrence);
        return byRecurrence
            || this.getCategoryGroup(a.categoryId).localeCompare(this.getCategoryGroup(b.categoryId))
            || (this.categoryMap().get(a.categoryId)?.name ?? '').localeCompare(this.categoryMap().get(b.categoryId)?.name ?? '');
    }

    getCategoryName(id: string) {
        const cat = this.categoryMap().get(id);
        return cat ? `${cat.icon} ${cat.name}` : id;
    }

    getCategoryGroup(id: string) {
        const cat = this.categoryMap().get(id);
        return (cat && this.groupMap().get(cat.groupId)?.name) ?? '';
    }

    async startAdd(type: BudgetStreamType) {
        await this.openStream({ type, categories: this.categories(), groups: this.groups() });
    }

    async startEdit(stream: BudgetStream) {
        await this.openStream({ stream, type: stream.type, categories: this.categories(), groups: this.groups() });
    }

    private async openStream(data: BudgetFormModalData) {
        const changed = await this.modalService.open<FinanceBudgetFormModalComponent, BudgetFormModalData, boolean>(
            FinanceBudgetFormModalComponent, data, { size: 'panel' }
        );
        if (changed) {
            this.data.reload();
        }
    }

    async delete(stream: BudgetStream) {
        if (await confirmDeleteStream(this.modalService, stream) && await this.financeService.deleteBudgetStream(stream.id)) {
            this.notificationService.success(`${streamTypeLabel(stream.type)} deleted`);
            this.data.reload();
        }
    }
}
