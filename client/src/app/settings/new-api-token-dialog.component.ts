import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { ApiTokenAccess } from '@shared/core/enum';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { ApiTokenService } from './api-token.service';

/**
 * Creates an API token (AUTH-11.2), then shows it once (AUTH-11.3).
 */
@Component({
    selector: 'app-new-api-token-dialog',
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatRadioModule,
        MatSelectModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './new-api-token-dialog.component.html',
    styleUrl: './new-api-token-dialog.component.scss'
})
export class NewApiTokenDialogComponent implements HasUnsavedChanges {
    private apiTokenService = inject(ApiTokenService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject(MatDialogRef<NewApiTokenDialogComponent>);

    readonly accessOptions = [
        { value: ApiTokenAccess.ReadOnly, label: 'Read-only' },
        { value: ApiTokenAccess.ReadWrite, label: 'Read & write' }
    ];
    readonly expirationOptions: { days: number | null; label: string }[] = [
        { days: 30, label: '30 days' },
        { days: 90, label: '90 days' },
        { days: 365, label: '1 year' },
        { days: null, label: 'No expiration' }
    ];

    form = inject(FormBuilder).nonNullable.group({
        name: ['', [Validators.required, Validators.maxLength(100)]],
        access: [ApiTokenAccess.ReadOnly],
        expiresInDays: [90 as number | null]
    });

    readonly isSaving = signal(false);
    readonly createdToken = signal<string | null>(null);

    private readonly tokenInput = viewChild<ElementRef<HTMLInputElement>>('tokenInput');

    hasUnsavedChanges(): boolean {
        return this.createdToken() === null && this.form.dirty;
    }

    async create(): Promise<void> {
        const name = this.form.controls.name.value.trim();
        if (!name || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const created = await this.apiTokenService.create({ ...this.form.getRawValue(), name });
        this.isSaving.set(false);

        if (created) {
            this.createdToken.set(created.token);
        }
    }

    async copy(): Promise<void> {
        const token = this.createdToken();
        if (!token) {
            return;
        }

        // The Clipboard API only exists in secure contexts (HTTPS or localhost). Over plain HTTP on the LAN,
        // select the text and copy it the older way.
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(token);
        } else {
            this.tokenInput()?.nativeElement.select();
            document.execCommand('copy');
        }
        this.notificationService.success('Token copied');
    }

    close(): void {
        this.dialogRef.close();
    }
}
