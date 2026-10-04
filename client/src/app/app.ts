import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/auth.service';
import { LayoutService } from './core/layout/layout.service';
import { ModeBadgeComponent } from './core/layout/mode-badge.component';
import { ProfileMenuComponent } from './core/layout/profile-menu.component';

interface NavItem {
    label: string;
    route: string;
    icon: string;
    /** The first URL segments that belong to this section, so it stays highlighted on the screens below it. */
    sections: string[];
}

/** How the navigation is shown: a bottom bar on phones, a rail on tablets, a side navigation on desktops. */
type NavMode = 'bottom' | 'rail' | 'side';

@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, RouterLink, MatSidenavModule, MatIconModule, ModeBadgeComponent, ProfileMenuComponent],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App {
    private layout = inject(LayoutService);
    private router = inject(Router);
    readonly authService = inject(AuthService);

    // APP-1.1
    readonly navItems: NavItem[] = [
        { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', sections: ['dashboard', 'accounts'] },
        { label: 'Transactions', route: '/transactions', icon: 'receipt_long', sections: ['transactions'] },
        { label: 'Spending', route: '/spending', icon: 'bar_chart', sections: ['spending'] },
        { label: 'Budget', route: '/budget', icon: 'savings', sections: ['budget'] }
    ];

    private readonly url = toSignal(
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(event => event.urlAfterRedirects)
        ),
        { initialValue: this.router.url }
    );

    readonly activeRoute = computed(() => {
        const section = this.url().split(/[/?#]/)[1];
        return this.navItems.find(item => item.sections.includes(section))?.route ?? null;
    });

    readonly navMode = computed<NavMode>(() => {
        switch (this.layout.sizeClass()) {
            case 'compact':
                return 'bottom';
            case 'medium':
                return 'rail';
            default:
                return 'side';
        }
    });

    constructor() {
        effect(() =>
            this.layout.hasBottomNav.set(this.navMode() === 'bottom' && this.authService.currentUser() !== null)
        );
    }
}
