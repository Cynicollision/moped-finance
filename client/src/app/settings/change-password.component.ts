import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PasswordRules } from '@shared/core/util';
import { AuthService } from './../core/auth.service';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { SkeletonComponent } from './../core/loading/skeleton.component';
import { viewResource } from './../core/loading/view-resource';
import { NotificationService } from './../core/notification.service';
import { PasswordRulesComponent } from './../core/password/password-rules.component';
import { HasUnsavedChanges } from './../core/unsaved-changes';

// The Change Password page of Settings (AUTH-5.2, AUTH-5.3).
@Component({
    selector: 'app-change-password',
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        PageHeaderComponent,
        LoadErrorComponent,
        SkeletonComponent,
        PasswordRulesComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './change-password.component.html',
    styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements HasUnsavedChanges {
    private authService = inject(AuthService);
    private notificationService = inject(NotificationService);

    readonly passwordPolicy = viewResource({ loader: () => this.authService.fetchPasswordPolicy() });
    readonly username = computed(() => this.authService.currentUser()?.username ?? '');
    readonly saving = signal(false);

    readonly form = new FormGroup({
        currentPassword: new FormControl('', { nonNullable: true }),
        newPassword: new FormControl('', { nonNullable: true }),
        confirmPassword: new FormControl('', { nonNullable: true })
    });
    private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

    readonly newPassword = computed(() => this.values().newPassword ?? '');
    /** Shown once both new passwords are filled in and differ (AUTH-5.2). */
    readonly mismatch = computed(() => {
        const { newPassword, confirmPassword } = this.values();
        return !!newPassword && !!confirmPassword && newPassword !== confirmPassword;
    });
    readonly meetsPasswordRules = computed(() => {
        const policy = this.passwordPolicy.value();
        return !!policy && PasswordRules.problems(this.newPassword(), this.username(), policy.minLength).length === 0;
    });
    /** All three filled in (AUTH-5.2), matching, and the new one meeting the rules. */
    readonly canSubmit = computed(() => {
        const { currentPassword, newPassword, confirmPassword } = this.values();
        const filled = !!currentPassword && !!newPassword && !!confirmPassword;
        return filled && !this.mismatch() && this.meetsPasswordRules() && !this.saving();
    });

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async changePassword() {
        if (!this.canSubmit()) {
            return;
        }

        const { currentPassword, newPassword } = this.form.getRawValue();
        this.saving.set(true);
        const changed = await this.authService.changePassword(currentPassword, newPassword);
        this.saving.set(false);
        if (changed) {
            // AUTH-5.3: clear the form and stay signed in
            this.form.reset();
            this.notificationService.success('Password changed.');
        }
    }
}
