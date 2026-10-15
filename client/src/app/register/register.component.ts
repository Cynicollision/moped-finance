import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PasswordRules } from '@shared/core/util';
import { AuthService } from './../core/auth.service';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
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
        RouterLink,
        LoadErrorComponent,
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
    readonly errorMessage = signal('');
    readonly submitting = signal(false);

    // The password rules to check as the user types (AUTH-2.11, AUTH-9.4)
    readonly passwordPolicy = viewResource({ loader: () => this.authService.fetchPasswordPolicy() });
    readonly meetsPasswordRules = computed(() => {
        const policy = this.passwordPolicy.value();
        return !!policy && PasswordRules.problems(this.password(), this.username(), policy.minLength).length === 0;
    });

    async onRegister() {
        this.errorMessage.set('');

        if (!this.username() || !this.displayName() || !this.password()) {
            this.errorMessage.set('All fields are required.');
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
            await this.authService.register(this.username(), this.displayName(), this.password(), returnUrl);
        } catch (error) {
            // API service handles showing notifications, but we can set local error if needed.
            this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred during registration.');
        } finally {
            this.submitting.set(false);
        }
    }
}
