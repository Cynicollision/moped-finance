import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryGroup, Category } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { CategoryGroupFormModalComponent, CategoryGroupFormModalData } from './category-group-form-modal.component';
import { CategoryFormModalComponent, CategoryFormModalData } from './category-form-modal.component';

interface GroupedCategories {
    group: CategoryGroup;
    categories: Category[];
}

@Component({
    selector: 'app-finance-categories',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule
    ],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss'
})
export class FinanceCategoriesComponent implements OnInit {
    private financeService = inject(FinanceService);
    private cdr = inject(ChangeDetectorRef);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    groups: CategoryGroup[] = [];
    categories: Category[] = [];

    expenseGroups: GroupedCategories[] = [];
    incomeGroups: GroupedCategories[] = [];

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const [groups, categories] = await Promise.all([
            this.financeService.fetchCategoryGroups(),
            this.financeService.fetchCategories(false)
        ]);

        this.groups = groups || [];
        this.categories = categories || [];

        this.groupData();
        this.cdr.detectChanges();
    }

    private groupData() {
        const buildGrouped = (targetClass: CategoryClass) => {
            return this.groups
                .filter(g => g.class === targetClass)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(group => ({
                    group,
                    categories: this.categories
                        .filter(c => c.groupId === group.id)
                        .sort((a, b) => {
                            if (a.isActive !== b.isActive) {
                                return a.isActive ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                        })
                }));
        };

        this.expenseGroups = buildGrouped(CategoryClass.Expense);
        this.incomeGroups = buildGrouped(CategoryClass.Income);
    }

    async startAddGroup() {
        const result = await this.modalService.open<CategoryGroupFormModalComponent, CategoryGroupFormModalData, CategoryGroup>(
            CategoryGroupFormModalComponent, {}
        );
        if (result) {
            await this.financeService.createCategoryGroup(result);
            await this.loadData();
        }
    }

    async editGroup(group: CategoryGroup) {
        const result = await this.modalService.open<CategoryGroupFormModalComponent, CategoryGroupFormModalData, CategoryGroup>(
            CategoryGroupFormModalComponent, { group }
        );
        if (result) {
            await this.financeService.saveCategoryGroup(result);
            await this.loadData();
        }
    }

    async startAddCategory(groupId?: string) {
        if (this.groups.length === 0) {
            this.notificationService.error('Please create a group first.');
            return;
        }

        const result = await this.modalService.open<CategoryFormModalComponent, CategoryFormModalData, Category>(
            CategoryFormModalComponent, { groups: this.groups, initialGroupId: groupId }
        );
        if (result) {
            await this.financeService.createCategory(result);
            await this.loadData();
        }
    }

    async editCategory(category: Category) {
        const result = await this.modalService.open<CategoryFormModalComponent, CategoryFormModalData, Category>(
            CategoryFormModalComponent, { category, groups: this.groups }
        );
        if (result) {
            await this.financeService.saveCategory(result);
            await this.loadData();
        }
    }
}
