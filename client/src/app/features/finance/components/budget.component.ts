import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { Category, BudgetStream } from '@shared/finance/types';
import { BudgetStreamType, BudgetStreamRecurrence, CategoryClass } from '@shared/finance/enum';
import { FinanceService } from '../finance.service';
import { ModalService } from '../../../core/modal/modal.service';
import { BudgetFormModalComponent, BudgetFormModalData } from './budget-form-modal.component';
import { ConfirmModalComponent, ConfirmModalData } from '../../../core/modal/confirm-modal.component';

@Component({
    selector: 'app-finance-budget',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule
    ],
    templateUrl: './budget.component.html',
    styleUrl: './budget.component.scss'
})
export class FinanceBudgetComponent implements OnInit {
    private financeService = inject(FinanceService);
    private cdr = inject(ChangeDetectorRef);
    private modalService = inject(ModalService);

    categories: Category[] = [];
    categoryMap = new Map<string, Category>();
    budgetStreams: BudgetStream[] = [];

    BudgetStreamType = BudgetStreamType;

    incomeStreams: BudgetStream[] = [];
    expenseStreams: BudgetStream[] = [];

    displayedColumns: string[] = ['name', 'group', 'category', 'amount', 'recurrence', 'actions'];

    constructor() {}

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const [categories, budgetStreams] = await Promise.all([
            this.financeService.fetchCategories(false),
            this.financeService.fetchBudgetStreams()
        ]);

        this.categories = categories || [];
        this.categoryMap.clear();
        this.categories.forEach(c => this.categoryMap.set(c.id, c));

        this.budgetStreams = budgetStreams || [];
        this.splitStreams();
        this.cdr.detectChanges();
    }

    private splitStreams() {
        this.incomeStreams = this.budgetStreams
            .filter(s => s.type === BudgetStreamType.Income)
            .sort((a, b) => this.compareStreams(a, b));
            
        this.expenseStreams = this.budgetStreams
            .filter(s => s.type === BudgetStreamType.Expense)
            .sort((a, b) => this.compareStreams(a, b));
    }

    private compareStreams(a: BudgetStream, b: BudgetStream): number {
        const catA = this.categoryMap.get(a.categoryId);
        const catB = this.categoryMap.get(b.categoryId);

        const groupA = catA?.group || '';
        const groupB = catB?.group || '';

        if (groupA < groupB) return -1;
        if (groupA > groupB) return 1;

        const nameA = catA?.name || '';
        const nameB = catB?.name || '';

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        return 0;
    }

    getCategoriesByType(type: BudgetStreamType) {
        const targetClass = type === BudgetStreamType.Income ? CategoryClass.Income : CategoryClass.Expense;
        return this.categories.filter(c => c.class === targetClass);
    }

    getCategoryName(id: string) {
        const cat = this.categoryMap.get(id);
        return cat ? `${cat.icon} ${cat.name}` : id;
    }

    getCategoryGroup(id: string) {
        const cat = this.categoryMap.get(id);
        return cat ? cat.group : '';
    }

    startAdd(type: BudgetStreamType) {
        const dialogRef = this.modalService.open<BudgetFormModalComponent, BudgetFormModalData>(BudgetFormModalComponent, {
            type,
            categories: this.categories
        });
        
        dialogRef.afterClosed().subscribe(async (result: BudgetStream) => {
            if (result) {
                await this.save(result);
            }
        });
    }

    startEdit(stream: BudgetStream) {
        const dialogRef = this.modalService.open<BudgetFormModalComponent, BudgetFormModalData>(BudgetFormModalComponent, {
            stream,
            type: stream.type,
            categories: this.categories
        });
        
        dialogRef.afterClosed().subscribe(async (result: BudgetStream) => {
            if (result) {
                await this.save(result);
            }
        });
    }

    async save(stream: BudgetStream) {
        const result = await this.financeService.saveBudgetStream(stream);
        if (result) {
            await this.loadData();
        }
    }

    async delete(id: string) {
        const dialogRef = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
            title: 'Delete Budget Stream',
            message: 'Are you sure you want to delete this budget stream? This action cannot be undone.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        dialogRef.afterClosed().subscribe(async (confirmed) => {
            if (confirmed) {
                const success = await this.financeService.deleteBudgetStream(id);
                if (success) {
                    await this.loadData();
                }
            }
        });
    }
}