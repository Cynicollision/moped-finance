import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DISPLAY_NAME_MAX_LENGTH, PasswordRules, USERNAME_MAX_LENGTH } from '@shared/core/util';
import { AuthService } from './../core/auth.service';
import { PasswordRulesComponent } from './../core/password/password-rules.component';

@Component({
    selector: 'app-register',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatRadioModule,
        RouterLink,
        PasswordRulesComponent
    ],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss'
})
export class RegisterComponent {
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    readonly username = signal('');
    readonly displayName = signal('');
    readonly password = signal('');
    readonly confirmPassword = signal('');
    /** Start with the default categories, or with none (AUTH-2.9, CAT-6.1). */
    readonly defaultCategories = signal(true);
    readonly errorMessage = signal('');
    readonly submitting = signal(false);

    readonly usernameMaxLength = USERNAME_MAX_LENGTH;
    readonly displayNameMaxLength = DISPLAY_NAME_MAX_LENGTH;

    // The field limits (AUTH-2.10), flagged under each field. Blank fields only keep Register disabled (AUTH-2.2).
    readonly usernameProblem = computed(() => {
        const username = this.username();
        if (username.length > USERNAME_MAX_LENGTH) {
            return `Username can't be longer than ${USERNAME_MAX_LENGTH} characters`;
        }
        return username.trim() !== username ? "Username can't start or end with a space" : '';
    });
    readonly displayNameProblem = computed(() => {
        const displayName = this.displayName();
        if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
            return `Display name can't be longer than ${DISPLAY_NAME_MAX_LENGTH} characters`;
        }
        return displayName && !displayName.trim() ? 'Display name is required' : '';
    });

    // The password rules, checked as the user types (AUTH-2.11, AUTH-9.4)
    readonly meetsPasswordRules = computed(() => PasswordRules.problems(this.password(), this.username()).length === 0);

    async onRegister() {
        this.errorMessage.set('');

        if (!this.username() || !this.displayName() || !this.password()) {
            this.errorMessage.set('All fields are required.');
            return;
        }

        if (this.usernameProblem() || this.displayNameProblem()) {
            return;
        }

        if (this.password() !== this.confirmPassword()) {
            this.errorMessage.set('Passwords do not match.');
            return;
        }

        // The rules are listed under the field, marked unmet
        if (!this.meetsPasswordRules()) {
            return;
        }

        this.submitting.set(true);
        try {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];
            await this.authService.register(
                {
                    username: this.username(),
                    name: this.displayName(),
                    password: this.password(),
                    defaultCategories: this.defaultCategories()
                },
                returnUrl
            );
        } catch (error) {
            // API service handles showing notifications, but we can set local error if needed.
            this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred during registration.');
        } finally {
            this.submitting.set(false);
        }
    }
}
