import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryGroup, Category } from '@shared/finance/types';
import { CategoryType } from '@shared/finance/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
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
        TitleCasePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss'
})
export class FinanceCategoriesComponent {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    readonly data = viewResource({
        loader: async () => {
            const [groups, categories] = await Promise.all([
                this.financeService.fetchCategoryGroups(),
                this.financeService.fetchCategories(false)
            ]);
            return { groups, categories };
        }
    });
    private readonly groups = computed(() => this.data.value()?.groups ?? []);
    private readonly categories = computed(() => this.data.value()?.categories ?? []);

    // One section per type (CAT-1.3), each with its own empty message (CAT-1.5).
    readonly sections = computed(() => [
        {
            title: 'Income',
            empty: 'No income groups found.',
            groupedCategories: this.buildGrouped(CategoryType.Income)
        },
        {
            title: 'Expenses',
            empty: 'No expense groups found.',
            groupedCategories: this.buildGrouped(CategoryType.Expense)
        },
        {
            title: 'Transfers',
            empty: 'No transfer groups found.',
            groupedCategories: this.buildGrouped(CategoryType.Transfer)
        }
    ]);

    private buildGrouped(targetType: CategoryType): GroupedCategories[] {
        return this.groups()
            .filter(g => g.type === targetType)
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
        const changed = await this.modalService.open<
            CategoryGroupFormModalComponent,
            CategoryGroupFormModalData,
            boolean
        >(CategoryGroupFormModalComponent, data);
        if (changed) {
            this.data.reload();
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
        await this.openCategory({ category, groups: this.groups(), categories: this.categories() });
    }

    private async openCategory(data: CategoryFormModalData) {
        const changed = await this.modalService.open<CategoryFormModalComponent, CategoryFormModalData, boolean>(
            CategoryFormModalComponent,
            data
        );
        if (changed) {
            this.data.reload();
        }
    }
}
