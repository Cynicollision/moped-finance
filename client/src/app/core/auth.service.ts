import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@shared/types/core/entities/user';
import { OperationResponse } from '@shared/types/common/operation-response';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private loader = inject(LoadingService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  currentUser = signal<User | null>(null);

  async login(username: string): Promise<void> {
    // TODO: sending hardcoded sample data for now
    const credentials = { username: username, password: 'password' };

    try {
      const task = this.api.post<User>('auth/login', credentials);
      const response = await this.loader.withLoading(task);
      this.currentUser.set(response.data || null);
      this.router.navigate(['/']);
    }
    catch (err) {
      this.notificationService.error(`Login failed: ${err}`);
    }
  }

  async logout(): Promise<void> {
    try {
      const task = this.api.post('auth/logout', {});
      await this.loader.withLoading(task);
    }
    catch (err) {
      this.notificationService.error(`Login failed: ${err}`);
    }
    finally {
      // Ensure we logout on client side even if server fails
      this.currentUser.set(null);
      this.router.navigate(['/login']);
    }
  }
}