import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { FinanceService } from './../finance.service';
import { CategoryClass, BudgetPeriod } from '@shared/finance/enum';
import { Category } from '@shared/finance/types';
import { SpendingStream } from '@shared/finance/contracts';

@Component({
    selector: 'app-finance-spending',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatTableModule,
        MatIconModule
    ],
    templateUrl: './cashflow.component.html',
    styleUrl: './cashflow.component.scss'
})
export class FinanceCashflowComponent implements OnInit {
    private financeService = inject(FinanceService);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);

    BudgetPeriod = BudgetPeriod;
    periods = [BudgetPeriod.Monthly, BudgetPeriod.Quarterly, BudgetPeriod.Yearly];

    selectedPeriod: BudgetPeriod = BudgetPeriod.Monthly;
    viewMode: 'category' | 'group' = 'category';

    months = [
        { value: 0, label: 'January' }, { value: 1, label: 'February' },
        { value: 2, label: 'March' }, { value: 3, label: 'April' },
        { value: 4, label: 'May' }, { value: 5, label: 'June' },
        { value: 6, label: 'July' }, { value: 7, label: 'August' },
        { value: 8, label: 'September' }, { value: 9, label: 'October' },
        { value: 10, label: 'November' }, { value: 11, label: 'December' }
    ];
    quarters = [
        { value: 1, label: 'Q1' }, { value: 2, label: 'Q2' },
        { value: 3, label: 'Q3' }, { value: 4, label: 'Q4' }
    ];

    currentYear = new Date().getFullYear();
    years = [this.currentYear - 2, this.currentYear - 1, this.currentYear, this.currentYear + 1];

    selectedMonth = new Date().getMonth();
    selectedQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    selectedYear = this.currentYear;

    categories: Category[] = [];
    categoryMap = new Map<string, Category>();
    spendingStreams: SpendingStream[] = [];
    incomeStreams: { id?: string, name: string, amount: number }[] = [];
    expenseStreams: { id?: string, name: string, amount: number }[] = [];

    totalIncome: number = 0;
    totalExpenses: number = 0;
    totalSavings: number = 0;
    savingsRate: number = 0;

    Math = Math;

    displayedColumns: string[] = ['name', 'amount'];

    async ngOnInit() {
        const categories = await this.financeService.fetchCategories(false);
        this.categories = categories || [];
        this.categories.forEach(c => this.categoryMap.set(c.id, c));

        await this.loadData();
    }

    async loadData() {
        const asOfDate = this.getAsOfDate();
        const streams = await this.financeService.fetchSpendingStreams(this.selectedPeriod, asOfDate.toISOString().split('T')[0]);
        this.spendingStreams = streams || [];
        this.processData();
        this.cdr.detectChanges();
    }

    getAsOfDate(): Date {
        if (this.selectedPeriod === BudgetPeriod.Monthly) {
            return new Date(this.selectedYear, this.selectedMonth, 1);
        } else if (this.selectedPeriod === BudgetPeriod.Quarterly) {
            const firstMonthOfQuarter = (this.selectedQuarter - 1) * 3;
            return new Date(this.selectedYear, firstMonthOfQuarter, 1);
        } else {
            return new Date(this.selectedYear, 0, 1);
        }
    }

    processData() {
        const incomeMap = new Map<string, number>();
        const expenseMap = new Map<string, number>();

        this.spendingStreams.forEach(s => {
            const cat = s.categoryId ? this.categoryMap.get(s.categoryId) : undefined;

            if (cat?.class === CategoryClass.Transfer) {
                return;
            }

            let nameKey = 'Uncategorized';
            if (this.viewMode === 'category') {
                nameKey = cat ? `${cat.icon} ${cat.name}` : 'Uncategorized';
            } else {
                nameKey = cat?.group || 'Uncategorized';
            }

            if (cat?.class === CategoryClass.Income) {
                incomeMap.set(nameKey, (incomeMap.get(nameKey) || 0) + s.amount);
            } else {
                expenseMap.set(nameKey, (expenseMap.get(nameKey) || 0) + s.amount);
            }
        });

        const sortByAmountDesc = (a: { amount: number }, b: { amount: number }) => Math.abs(b.amount) - Math.abs(a.amount);

        let inc = 0;
        this.incomeStreams = Array.from(incomeMap.entries()).map(([name, amount]) => {
            inc += amount;
            // For category view, find the ID. For group, we just have the name.
            let id: string | undefined;
            if (this.viewMode === 'category') {
                id = Array.from(this.categoryMap.values()).find(c => `${c.icon} ${c.name}` === name)?.id;
            }
            return { id, name, amount };
        }).sort(sortByAmountDesc);

        let exp = 0;
        this.expenseStreams = Array.from(expenseMap.entries()).map(([name, amount]) => {
            exp += Math.abs(amount);
            let id: string | undefined;
            if (this.viewMode === 'category') {
                id = Array.from(this.categoryMap.values()).find(c => `${c.icon} ${c.name}` === name)?.id;
            }
            return { id, name, amount };
        }).sort(sortByAmountDesc);

        this.totalIncome = inc;
        this.totalExpenses = exp;
        this.totalSavings = this.totalIncome - this.totalExpenses;
        this.savingsRate = this.totalIncome > 0 ? (this.totalSavings / this.totalIncome) : 0;

        this.cdr.detectChanges();
    }

    onPeriodChange() {
        this.loadData();
    }

    onViewModeChange() {
        this.processData();
    }

    onRowClick(row: { id?: string, name: string }) {
        const queryParams: any = {};

        if (this.viewMode === 'category' && row.id) {
            queryParams.categoryId = row.id;
        }
        else if (this.viewMode === 'group') {
            queryParams.group = row.name;
        }

        const asOfDate = this.getAsOfDate();
        const startDate = new Date(asOfDate.getTime());
        const endDate = new Date(asOfDate.getTime());

        switch (this.selectedPeriod) {
            case BudgetPeriod.Monthly:
                startDate.setDate(1);
                endDate.setMonth(endDate.getMonth() + 1, 0);
                break;
            case BudgetPeriod.Quarterly:
                startDate.setDate(1);
                endDate.setMonth(endDate.getMonth() + 3, 0);
                break;
            case BudgetPeriod.Yearly:
                startDate.setMonth(0, 1);
                endDate.setMonth(11, 31);
                break;
        }

        queryParams.startDate = startDate.toISOString().split('T')[0];
        queryParams.endDate = endDate.toISOString().split('T')[0];

        this.router.navigate(['/finance/transactions'], { queryParams });
    }
}