import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RegistrationStatus, UpdateProfileRequest } from '@shared/core/contracts';
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

    /** Changes the password (AUTH-5.1); false if the server refused, which it has already reported. */
    async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
        const result = await this.api.put<unknown>('auth/password', { oldPassword, newPassword });
        return result !== undefined;
    }

    async register(username: string, displayName: string, password?: string, returnUrl?: string): Promise<void> {
        const payload = { username, name: displayName, password };
        const response = await this.api.post<User>('auth/register', payload);

        if (response) {
            this.currentUser.set(response);
            this.router.navigate([returnUrl || '/']);
        }
    }

    /** Saves the display name (SET-2.1) and updates the profile control with it; undefined if it failed. */
    async updateProfile(displayName: string): Promise<User | undefined> {
        const request: UpdateProfileRequest = { displayName };
        const user = await this.api.put<User>('auth/profile', request);
        if (user) {
            this.currentUser.set(user);
        }
        return user;
    }

    async logout(): Promise<void> {
        await this.api.post('auth/logout', {});
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }
}
