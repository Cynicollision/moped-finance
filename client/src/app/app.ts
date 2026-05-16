import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd, RouteConfigLoadStart, RouteConfigLoadEnd } from '@angular/router';
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
}

interface AppConfig {
    id: string;
    name: string;
    icon: string;
    defaultRoute: string;
    navItems: NavItem[];
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

    apps: AppConfig[] = [
        { id: 'home', name: 'Home', icon: 'home', defaultRoute: '/', navItems: [] },
        { 
            id: 'finance', name: 'Ledger', icon: 'attach_money', defaultRoute: '/finance', 
            navItems: [
                { label: 'Dashboard', route: '/finance/summary' },
                { label: 'Transactions', route: '/finance/transactions' },
                { label: 'Cashflow', route: '/finance/cashflow' },
                { label: 'Budget', route: '/finance/budget' }
            ] 
        },
        { 
            id: 'grounds', name: 'Grounds', icon: 'landscape', defaultRoute: '/grounds', 
            navItems: [
                { label: 'Summary', route: '/grounds/summary' },
                { label: 'Schedule', route: '/grounds/schedule' },
                { label: 'Plants', route: '/grounds/plants' },
                { label: 'Products', route: '/grounds/products' }
            ] 
        }
    ];

    currentApp: AppConfig = this.apps[0];
    currentNavItem: NavItem | null = null;

    get debugDateLabel(): string {
        const now = this.dateProvider.now();
        const y = now.getFullYear();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        return `${y}${m}${d}`;
    }

    // Observable to detect handset/mobile view
    isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
        .pipe(
            map(result => result.matches),
            shareReplay()
        );

    ngOnInit() {
        this.router.events.pipe(
            filter(event => event instanceof RouteConfigLoadStart || event instanceof RouteConfigLoadEnd)
        ).subscribe(event => {
            if (event instanceof RouteConfigLoadStart) {
                this.loadingService.show();
            } else if (event instanceof RouteConfigLoadEnd) {
                this.loadingService.hide();
            }
        });

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            const url = event.urlAfterRedirects;
            if (url.startsWith('/finance')) {
                this.currentApp = this.apps.find(a => a.id === 'finance')!;
            } else if (url.startsWith('/grounds')) {
                this.currentApp = this.apps.find(a => a.id === 'grounds')!;
            } else {
                this.currentApp = this.apps.find(a => a.id === 'home')!;
            }
            
            this.currentNavItem = this.currentApp.navItems.find(item => item.route === url) || null;
        });
    }

    logout() {
        this.authService.logout();
    }
}
