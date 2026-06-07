import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from './../core/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        RouterLink
    ],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss'
})
export class RegisterComponent {
    username = '';
    displayName = '';
    password = '';
    confirmPassword = '';
    errorMessage = '';

    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    async onRegister() {
        this.errorMessage = '';

        if (!this.username || !this.displayName || !this.password) {
            this.errorMessage = 'All fields are required.';
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.errorMessage = 'Passwords do not match.';
            return;
        }

        try {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];
            await this.authService.register(this.username, this.displayName, this.password, returnUrl);
        } catch (error: any) {
            // API service handles showing notifications, but we can set local error if needed.
            this.errorMessage = error.message || 'An error occurred during registration.';
        }
    }
}
