import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@shared/core/types/user';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private api = inject(ApiService);
    private router = inject(Router);

    currentUser = signal<User | null>(null);

    async checkSession(): Promise<void> {
        const response = await this.api.get<User>('auth/me');
        this.currentUser.set(response || null);
    }

    async login(username: string): Promise<void> {
        // TODO: sending hardcoded sample data for now
        const credentials = { username: username, password: 'password' };
        const response = await this.api.post<User>('auth/login', credentials);

        if (response) {
            this.currentUser.set(response);
            this.router.navigate(['/']);
        }
    }

    async logout(): Promise<void> {
        await this.api.post('auth/logout', {});
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }
}