import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RegistrationStatus } from '@shared/core/contracts';
import { User } from '@shared/core/types/user';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private api = inject(ApiService);
    private router = inject(Router);

    readonly currentUser = signal<User | null>(null);

    async checkSession(): Promise<void> {
        const response = await this.api.get<User>('auth/me');
        this.currentUser.set(response || null);
    }

    async login(username: string, password?: string, returnUrl?: string): Promise<void> {
        const credentials = { username, password };
        const response = await this.api.post<User>('auth/login', credentials);

        if (response) {
            this.currentUser.set(response);
            this.router.navigate([returnUrl || '/']);
        }
    }

    async isRegistrationOpen(): Promise<boolean> {
        const status = await this.api.get<RegistrationStatus>('auth/registration');
        return status?.isOpen ?? false;
    }

    async register(username: string, displayName: string, password?: string, returnUrl?: string): Promise<void> {
        const payload = { username, name: displayName, password };
        const response = await this.api.post<User>('auth/register', payload);

        if (response) {
            this.currentUser.set(response);
            this.router.navigate([returnUrl || '/']);
        }
    }

    async logout(): Promise<void> {
        await this.api.post('auth/logout', {});
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }
}
