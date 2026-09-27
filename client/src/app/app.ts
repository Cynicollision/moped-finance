import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Environment } from './../environments/environment';
import { AuthService } from './core/auth.service';
import { LoadingOverlayComponent } from './core/loading/loading-overlay.component';
import { DateProviderService } from './core/date-provider.service';
import { LayoutService } from './core/layout/layout.service';

interface NavItem {
    label: string;
    route: string;
    icon: string;
}

@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
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
export class App {
    private layout = inject(LayoutService);
    authService = inject(AuthService);
    private dateProvider = inject(DateProviderService);
    private router = inject(Router);

    readonly isDebugMode = Environment.isDebugMode;
    readonly isDemoMode = Environment.demoMode;

    readonly navItems: NavItem[] = [
        { label: 'Accounts', route: '/summary', icon: 'account_balance_wallet' },
        { label: 'Transactions', route: '/transactions', icon: 'credit_card' },
        { label: 'Cashflow', route: '/cashflow', icon: 'bar_chart' },
        { label: 'Budget', route: '/budget', icon: 'pie_chart' },
        { label: 'Categories', route: '/categories', icon: 'category' },
        { label: 'Institutions', route: '/institutions', icon: 'account_balance' }
    ];

    readonly currentNavItem = toSignal(
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(event => this.navItems.find(item => item.route === event.urlAfterRedirects) ?? null)
        ),
        { initialValue: null }
    );

    readonly debugDateLabel = computed(() => this.dateProvider.today().replace(/-/g, ''));

    readonly userInitials = computed(() => {
        const name = this.authService.currentUser()?.displayName || '';
        if (!name) {
            return '?';
        }
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    });

    // Below the expanded size class the side navigation opens over the content from a menu button.
    readonly isHandset = computed(() => !this.layout.atLeast('expanded'));

    logout() {
        this.authService.logout();
    }
}
