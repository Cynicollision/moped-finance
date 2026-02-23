import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/auth.service';
import { LoadingOverlayComponent } from './core/loading-overlay.component';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    LoadingOverlayComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private breakpointObserver = inject(BreakpointObserver);
  authService = inject(AuthService);

  // Configuration for navigation items
  navItems: NavItem[] = [
    { label: 'Home', route: '/', icon: 'home' },
    { label: 'Finance', route: '/finance', icon: 'attach_money' },
    { label: 'Grounds', route: '/grounds', icon: 'landscape' }
  ];

  // Observable to detect handset/mobile view
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  logout() {
    this.authService.logout();
  }
}
