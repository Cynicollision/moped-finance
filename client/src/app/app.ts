import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay, filter } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Environment } from './../environments/environment';
import { AuthService } from './core/auth.service';
import { LoadingOverlayComponent } from './core/loading/loading-overlay.component';
import { DateProviderService } from './core/date-provider.service';
import { LoadingService } from './core/loading/loading.service';

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
        MatMenuModule,
        LoadingOverlayComponent
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App implements OnInit {
    private breakpointObserver = inject(BreakpointObserver);
    authService = inject(AuthService);
    private dateProvider = inject(DateProviderService);
    private router = inject(Router);
    private loadingService = inject(LoadingService);

    isDebugMode = Environment.isDebugMode;

    navItems: NavItem[] = [
        { label: 'Accounts', route: '/summary', icon: 'account_balance_wallet' },
        { label: 'Transactions', route: '/transactions', icon: 'credit_card' },
        { label: 'Cashflow', route: '/cashflow', icon: 'bar_chart' },
        { label: 'Budget', route: '/budget', icon: 'pie_chart' },
        { label: 'Categories', route: '/categories', icon: 'category' },
        { label: 'Institutions', route: '/institutions', icon: 'account_balance' }
    ];

    currentNavItem: NavItem | null = null;

    get debugDateLabel(): string {
        const now = this.dateProvider.now();
        const y = now.getFullYear();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        return `${y}${m}${d}`;
    }

    getUserInitials(): string {
        const name = this.authService.currentUser()?.displayName || '';
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    }

    // Observable to detect handset/mobile view
    isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
        .pipe(
            map(result => result.matches),
            shareReplay()
        );

    ngOnInit() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            const url = event.urlAfterRedirects;
            this.currentNavItem = this.navItems.find(item => item.route === url) || null;
        });
    }

    logout() {
        this.authService.logout();
    }
}
