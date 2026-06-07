import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Environment } from './../../environments/environment';
import { AuthService } from './../core/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        RouterLink
    ],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent {
    username = Environment.devUsername;
    password = Environment.devPassword;
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    onLogin() {
        if (this.username) {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];
            this.authService.login(this.username, this.password, returnUrl);
        }
    }
}