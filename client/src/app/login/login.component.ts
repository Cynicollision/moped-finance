import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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
    changeDetection: ChangeDetectionStrategy.OnPush,
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
export class LoginComponent implements OnInit {
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    readonly username = signal(Environment.devUsername);
    readonly password = signal(Environment.devPassword);
    readonly registrationOpen = signal(false);

    async ngOnInit() {
        this.registrationOpen.set(await this.authService.isRegistrationOpen());
    }

    onLogin() {
        if (this.username()) {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];
            this.authService.login(this.username(), this.password(), returnUrl);
        }
    }
}
