import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CareTask } from '@shared/grounds/types/care-task';
import { CareTaskCategory } from '@shared/grounds/enum/care-task-category';
import { CareTaskType } from '@shared/grounds/enum/care-task-type';
import { CareTaskStatus } from '@shared/grounds/enum/care-task-status';
import { GroundsService } from './../grounds.service';

export interface TaskFormModalData {
    task?: CareTask;
    month: string;
    week: number;
    year: number;
    category: CareTaskCategory | 'All';
    products?: any[];
}

@Component({
    selector: 'app-task-form-modal',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule
    ],
    templateUrl: './task-form-modal.component.html',
    styleUrls: ['./task-form-modal.component.scss']
})
export class TaskFormModalComponent implements OnInit {
    private fb = inject(FormBuilder);
    private groundsService = inject(GroundsService);

    form!: FormGroup;
    isSaving = false;

    categories = Object.values(CareTaskCategory);
    statuses = Object.values(CareTaskStatus);
    allTypes = Object.values(CareTaskType);
    availableTypes: CareTaskType[] = [];

    months = [
        { value: 'january', label: 'January' },
        { value: 'february', label: 'February' },
        { value: 'march', label: 'March' },
        { value: 'april', label: 'April' },
        { value: 'may', label: 'May' },
        { value: 'june', label: 'June' },
        { value: 'july', label: 'July' },
        { value: 'august', label: 'August' },
        { value: 'september', label: 'September' },
        { value: 'october', label: 'October' },
        { value: 'november', label: 'November' },
        { value: 'december', label: 'December' }
    ];

    years: string[] = [];

    constructor(
        public dialogRef: MatDialogRef<TaskFormModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TaskFormModalData
    ) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 2; y++) {
            this.years.push(y.toString());
        }
    }

    ngOnInit() {
        const defaultCategory = (this.data.category !== 'All' ? this.data.category : CareTaskCategory.Lawn) as CareTaskCategory;

        this.form = this.fb.group({
            id: [this.data.task?.id],
            name: [this.data.task?.name || '', Validators.required],
            category: [this.data.task?.category || defaultCategory, Validators.required],
            type: [this.data.task?.type, Validators.required],
            targetMonth: [this.data.task?.targetMonth || this.data.month],
            targetWeek: [this.data.task?.targetWeek || this.data.week],
            year: [this.data.task?.year || this.data.year.toString(), Validators.required],
            status: [this.data.task?.status || CareTaskStatus.Pending, Validators.required],
            completedDate: [this.formatDateForInput(this.data.task?.completedDate)],
            isAnnualTask: [this.data.task?.isAnnualTask || false],
            notes: [this.data.task?.notes || ''],
            productId: [this.data.task?.productId || null]
        });

        // Initialize available types based on initial category
        this.updateAvailableTypes(this.form.get('category')?.value);

        // Initialize validators for completed date based on initial status
        this.updateCompletedDateValidator(this.form.get('status')?.value);

        // Listen for category changes
        this.form.get('category')?.valueChanges.subscribe(cat => {
            this.updateAvailableTypes(cat);
        });

        // Listen for status changes
        this.form.get('status')?.valueChanges.subscribe(status => {
            this.updateCompletedDateValidator(status);
        });
    }

    private formatDateForInput(date?: Date | string | null): string {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    private updateCompletedDateValidator(status: CareTaskStatus | string) {
        const completedDateControl = this.form.get('completedDate');
        if (typeof status === 'string' && status.toLowerCase() === 'completed') {
            completedDateControl?.setValidators([Validators.required]);
        }
        else {
            completedDateControl?.clearValidators();
            // Optional: clear the value if they change back to pending
            // completedDateControl?.setValue(null);
        }
        completedDateControl?.updateValueAndValidity();
    }

    updateAvailableTypes(category: CareTaskCategory) {
        if (category === CareTaskCategory.Lawn) {
            this.availableTypes = [CareTaskType.LawnHealth, CareTaskType.Watering, CareTaskType.Other];
            // Auto default if currently null or invalid
            if (!this.availableTypes.includes(this.form.get('type')?.value)) {
                this.form.get('type')?.setValue(CareTaskType.LawnHealth);
            }
        }
        else if (category === CareTaskCategory.Garden) {
            // Include everything except LawnHealth
            this.availableTypes = this.allTypes.filter(t => t !== CareTaskType.LawnHealth);
            if (!this.availableTypes.includes(this.form.get('type')?.value)) {
                this.form.get('type')?.setValue(CareTaskType.Planting);
            }
        }
        else {
            this.availableTypes = this.allTypes;
        }
    }

    async save() {
        if (this.form.invalid) return;

        this.isSaving = true;
        const taskData: CareTask = { ...this.data.task, ...this.form.value };

        // Convert empty string from completedDate back to undefined to avoid validation failure on backend
        if (!taskData.completedDate) {
            delete taskData.completedDate;
        }
        else {
            taskData.completedDate = new Date(taskData.completedDate as any);
        }

        const result = taskData.id
            ? await this.groundsService.saveTask(taskData)
            : await this.groundsService.createTask(taskData);
        this.isSaving = false;

        if (result) {
            this.dialogRef.close(true);
        }
    }
}
