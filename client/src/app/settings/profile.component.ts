import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DISPLAY_NAME_MAX_LENGTH } from '@shared/core/util';
import { AuthService } from './../core/auth.service';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';

// The Profile page of Settings (SET-2.1): the username, read-only, and the display name.
@Component({
    selector: 'app-profile',
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        PageHeaderComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})
export class ProfileComponent implements HasUnsavedChanges {
    private authService = inject(AuthService);
    private notificationService = inject(NotificationService);

    readonly maxLength = DISPLAY_NAME_MAX_LENGTH;
    // The app restores the signed-in user before it shows any signed-in screen (AUTH-3.1).
    readonly user = this.authService.currentUser;
    readonly saving = signal(false);

    readonly form = new FormGroup({
        displayName: new FormControl(this.user()?.displayName ?? '', {
            nonNullable: true,
            // Spaces alone don't count as a name
            validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)]
        })
    });

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async save() {
        if (this.form.invalid || this.saving()) {
            return;
        }

        this.saving.set(true);
        const user = await this.authService.updateProfile(this.form.controls.displayName.value.trim());
        this.saving.set(false);
        if (user) {
            this.form.reset({ displayName: user.displayName });
            this.notificationService.success('Profile saved');
        }
    }
}
