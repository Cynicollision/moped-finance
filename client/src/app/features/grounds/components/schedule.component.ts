import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterModule } from '@angular/router';
import { CareTask } from '@shared/grounds/types/care-task';
import { CareTaskCategory } from '@shared/grounds/enum/care-task-category';
import { DateProviderService } from './../../../core/date-provider.service';
import { ModalService } from './../../../core/modal/modal.service';
import { GroundsService } from './../grounds.service';
import { TaskFormModalComponent, TaskFormModalData } from './task-form-modal.component';

export interface ScheduleRow {
    monthLabel: string;
    monthKey: string;
    week: number;
    tasks: CareTask[];
    isFirstWeekOfMonth: boolean;
    rowspan: number;
}

@Component({
    selector: 'app-lawn',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatCardModule, MatTableModule,
        MatButtonModule, MatIconModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatButtonToggleModule, RouterModule
    ],
    templateUrl: './schedule.component.html',
    styleUrls: ['./schedule.component.scss']
})
export class GroundsScheduleComponent implements OnInit {
    groundsService = inject(GroundsService);
    modalService = inject(ModalService);
    dateProvider = inject(DateProviderService);

    // Filter state
    selectedYear = signal<number>(this.dateProvider.now().getFullYear());
    selectedCategory = signal<string>('All');

    displayedColumns: string[] = ['month', 'week', 'activities'];
    dataSource = signal<ScheduleRow[]>([]);

    months = [
        { key: 'march', label: 'March' },
        { key: 'april', label: 'April' },
        { key: 'may', label: 'May' },
        { key: 'june', label: 'June' },
        { key: 'july', label: 'July' },
        { key: 'august', label: 'August' },
        { key: 'september', label: 'September' },
        { key: 'october', label: 'October' },
        { key: 'november', label: 'November' }
    ];

    allTasks: CareTask[] = [];
    products: any[] = [];
    availableYears: number[] = [];

    ngOnInit() {
        const currentYear = this.dateProvider.now().getFullYear();
        this.availableYears = [
            currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2
        ];
        this.loadTasks();
    }

    async loadTasks() {
        const [tasks, prods] = await Promise.all([
            this.groundsService.fetchTasks(this.selectedYear()),
            this.groundsService.fetchProducts()
        ]);
        this.allTasks = tasks || [];
        this.products = prods || [];
        this.buildSchedule();
    }

    getProductName(id?: string): string {
        if (!id) {
            return '';
        }
        const p = this.products.find(x => x.id === id);
        return p ? p.name : '';
    }

    getCategoryEmoji(category: string): string {
        return category === CareTaskCategory.Lawn ? '🍀' : '🌿';
    }

    onYearChange() {
        this.loadTasks();
    }

    onCategoryChange() {
        this.buildSchedule();
    }

    buildSchedule() {
        const rows: ScheduleRow[] = [];

        // Filter by category if not 'All'
        const categoryFilter = this.selectedCategory();
        const filteredTasks = categoryFilter === 'All'
            ? this.allTasks
            : this.allTasks.filter(t => t.category === categoryFilter);

        for (const month of this.months) {
            const numWeeks = 4;
            const monthStartIndex = rows.length;

            for (let week = 1; week <= numWeeks; week++) {
                // Find all tasks for this month and week
                const weekTasks = filteredTasks.filter(t =>
                    t.targetMonth?.toLowerCase() === month.key && t.targetWeek === week
                );

                rows.push({
                    monthLabel: month.label,
                    monthKey: month.key,
                    week: week,
                    tasks: weekTasks,
                    isFirstWeekOfMonth: week === 1,
                    rowspan: numWeeks
                });
            }
        }

        this.dataSource.set(rows);
    }

    async openTaskModal(row: ScheduleRow, task?: CareTask) {
        // Open the modal passing the task (if editing) and location (month/week)
        const result = await this.modalService.open<TaskFormModalComponent, TaskFormModalData>(
            TaskFormModalComponent,
            {
                task: task,
                month: row.monthKey,
                week: row.week,
                year: this.selectedYear(),
                category: this.selectedCategory() as CareTaskCategory | 'All',
                products: this.products
            }
        );

        if (result) {
            this.loadTasks();
        }
    }
}