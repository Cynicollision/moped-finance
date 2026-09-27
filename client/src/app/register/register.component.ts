import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from './../core/auth.service';

@Component({
    selector: 'app-register',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        RouterLink
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

        try {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];
            await this.authService.register(this.username(), this.displayName(), this.password(), returnUrl);
        }
        catch (error) {
            // API service handles showing notifications, but we can set local error if needed.
            this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred during registration.');
        }
    }
}
