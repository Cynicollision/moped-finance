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
import { Category, BudgetStream } from '@shared/finance/types';
import { BudgetStreamType, BudgetStreamRecurrence, CategoryClass } from '@shared/finance/enum';
import { FinanceService } from '../finance.service';

@Component({
    selector: 'app-finance-budget',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule
    ],
    templateUrl: './budget.component.html',
    styleUrl: './budget.component.scss'
})
export class FinanceBudgetComponent implements OnInit {
    private financeService = inject(FinanceService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    categories: Category[] = [];
    categoryMap = new Map<string, Category>();
    budgetStreams: BudgetStream[] = [];

    BudgetStreamType = BudgetStreamType;
    BudgetStreamRecurrence = BudgetStreamRecurrence;
    recurrenceOptions = Object.values(BudgetStreamRecurrence);

    incomeStreams: BudgetStream[] = [];
    expenseStreams: BudgetStream[] = [];

    displayedColumns: string[] = ['name', 'category', 'amount', 'recurrence', 'actions'];

    budgetForm: FormGroup;
    editingStreamId: string | null = null;
    isAdding = false;

    constructor() {
        this.budgetForm = this.fb.group({
            id: [null],
            type: [BudgetStreamType.Expense, Validators.required],
            name: ['', Validators.required],
            categoryId: ['', Validators.required],
            amount: [0, [Validators.required, Validators.min(0)]],
            recurrence: [BudgetStreamRecurrence.Monthly, Validators.required],
            recurrenceMultiple: [1, [Validators.required, Validators.min(1)]]
        });
    }

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
    }

    private splitStreams() {
        this.incomeStreams = this.budgetStreams.filter(s => s.type === BudgetStreamType.Income);
        this.expenseStreams = this.budgetStreams.filter(s => s.type === BudgetStreamType.Expense);
    }

    getCategoriesByType(type: BudgetStreamType) {
        const targetClass = type === BudgetStreamType.Income ? CategoryClass.Income : CategoryClass.Expense;
        return this.categories.filter(c => c.class === targetClass);
    }

    getCategoryName(id: string) {
        const cat = this.categoryMap.get(id);
        return cat ? `${cat.icon} ${cat.name}` : id;
    }

    startAdd(type: BudgetStreamType) {
        this.isAdding = true;
        this.editingStreamId = null;
        this.budgetForm.reset({
            type,
            name: '',
            categoryId: '',
            amount: 0,
            recurrence: BudgetStreamRecurrence.Monthly,
            recurrenceMultiple: 1
        });
    }

    startEdit(stream: BudgetStream) {
        this.isAdding = false;
        this.editingStreamId = stream.id;
        this.budgetForm.patchValue(stream);
    }

    async save() {
        if (this.budgetForm.invalid) return;

        const stream: BudgetStream = this.budgetForm.value;
        const result = await this.financeService.saveBudgetStream(stream);

        if (result) {
            await this.loadData();
            this.cancel();
        }
    }

    async delete(id: string) {
        // TODO: better modal/confirm experience
        if (confirm('Are you sure you want to delete this budget stream?')) {
            const success = await this.financeService.deleteBudgetStream(id);
            if (success) {
                // Instantly update the list locally
                this.budgetStreams = [...this.budgetStreams.filter(s => s.id !== id)];
                this.splitStreams();
                this.cdr.detectChanges(); // Force UI update

                // Then optionally reload from server to stay in sync, 
                // but use a slight delay or cache buster to ensure DB is ready
                setTimeout(async () => {
                    await this.loadData();
                }, 500);
            }
        }
    }

    cancel() {
        this.isAdding = false;
        this.editingStreamId = null;
        this.budgetForm.reset();
    }
}