import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@shared/types/core/entities/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<User | null>(null);

  constructor(private router: Router) {}

  login(username: string): void {
    // TODO: Simulating login with a fixed user object based on input
    const user: User = {
      id: '1',
      username: username,
      name: username
    };
    
    this.currentUser.set(user);
    this.router.navigate(['/']);
  }

  logout(): void {
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}