import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryGroup, Category } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
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
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        LowerCasePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        PageHeaderComponent
    ],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss'
})
export class FinanceCategoriesComponent implements OnInit {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    private readonly groups = signal<CategoryGroup[]>([]);
    private readonly categories = signal<Category[]>([]);

    readonly sections = computed(() => [
        { title: 'Income', groupedCategories: this.buildGrouped(CategoryClass.Income) },
        { title: 'Expenses', groupedCategories: this.buildGrouped(CategoryClass.Expense) }
    ]);

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const [groups, categories] = await Promise.all([
            this.financeService.fetchCategoryGroups(),
            this.financeService.fetchCategories(false)
        ]);

        this.groups.set(groups || []);
        this.categories.set(categories || []);
    }

    private buildGrouped(targetClass: CategoryClass): GroupedCategories[] {
        return this.groups()
            .filter(g => g.class === targetClass)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(group => ({
                group,
                categories: this.categories()
                    .filter(c => c.groupId === group.id)
                    .sort((a, b) => {
                        if (a.isActive !== b.isActive) {
                            return a.isActive ? -1 : 1;
                        }
                        return a.name.localeCompare(b.name);
                    })
            }));
    }

    async startAddGroup() {
        await this.openGroup({});
    }

    async editGroup(group: CategoryGroup) {
        const categoryCount = this.categories().filter(c => c.groupId === group.id).length;
        await this.openGroup({ group, categoryCount });
    }

    private async openGroup(data: CategoryGroupFormModalData) {
        const changed = await this.modalService.open<CategoryGroupFormModalComponent, CategoryGroupFormModalData, boolean>(
            CategoryGroupFormModalComponent, data
        );
        if (changed) {
            await this.loadData();
        }
    }

    async startAddCategory(groupId?: string) {
        if (this.groups().length === 0) {
            this.notificationService.error('Please create a group first.');
            return;
        }

        await this.openCategory({ groups: this.groups(), initialGroupId: groupId });
    }

    async editCategory(category: Category) {
        await this.openCategory({ category, groups: this.groups() });
    }

    private async openCategory(data: CategoryFormModalData) {
        const changed = await this.modalService.open<CategoryFormModalComponent, CategoryFormModalData, boolean>(
            CategoryFormModalComponent, data
        );
        if (changed) {
            await this.loadData();
        }
    }
}
