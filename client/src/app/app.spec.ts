import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@shared/core/types/user';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { DateProviderService } from './core/date-provider.service';
import { LayoutService, SizeClass } from './core/layout/layout.service';
import { LoadingService } from './core/loading/loading.service';

describe('App', () => {
    const user = { id: '1', displayName: 'Ada Lovelace', username: 'ada' } as User;

    async function render(sizeClass: SizeClass, currentUser: User | null = user): Promise<HTMLElement> {
        const size = signal(sizeClass);
        TestBed.configureTestingModule({
            imports: [App],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { currentUser: signal(currentUser), logout: vi.fn() } },
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 0, 1), today: () => '2026-01-01' } },
                { provide: LoadingService, useValue: { isLoading: signal(false) } },
                { provide: LayoutService, useValue: { sizeClass: size, isCompact: computed(() => size() === 'compact'), hasBottomNav: signal(false) } }
            ]
        });

        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    function navLabels(nav: Element): string[] {
        return Array.from(nav.querySelectorAll('.nav-label')).map(label => label.textContent!.trim());
    }

    it('APP-1.1 should offer Dashboard, Transactions, Cashflow and Budget, in that order', async () => {
        const element = await render('large');

        const nav = element.querySelector('nav[aria-label="Main"]')!;
        expect(navLabels(nav)).toEqual(['Dashboard', 'Transactions', 'Cashflow', 'Budget']);
        expect(Array.from(nav.querySelectorAll('a')).map(link => link.getAttribute('href')))
            .toEqual(['/dashboard', '/transactions', '/cashflow', '/budget']);
    });

    it('APP-1.2 should show a bottom navigation bar on phones', async () => {
        const element = await render('compact');

        expect(element.querySelector('mat-sidenav')).toBeNull();
        expect(navLabels(element.querySelector('nav.bottom-nav')!)).toEqual(['Dashboard', 'Transactions', 'Cashflow', 'Budget']);
    });

    it('APP-1.2 should show a navigation rail on tablets, and the side navigation from 840px', async () => {
        const tablet = await render('medium');
        expect(tablet.querySelector('mat-sidenav.rail')).not.toBeNull();
        expect(tablet.querySelector('.bottom-nav')).toBeNull();

        TestBed.resetTestingModule();
        const desktop = await render('expanded');
        expect(desktop.querySelector('mat-sidenav:not(.rail)')).not.toBeNull();
        expect(desktop.querySelector('.brand-title')!.textContent).toBe('Moped Finance');
    });

    it('APP-1.4 should show the profile control with initials and display name in the side navigation', async () => {
        const element = await render('large');

        const profile = element.querySelector('.profile-trigger')!;
        expect(profile.querySelector('.avatar')!.textContent).toBe('AL');
        expect(profile.querySelector('.profile-name')!.textContent).toBe('Ada Lovelace');
    });

    it('APP-1.7 should show no navigation or profile control when signed out', async () => {
        const element = await render('large', null);

        expect(element.querySelector('nav')).toBeNull();
        expect(element.querySelector('app-profile-menu')).toBeNull();
        expect(element.querySelector('router-outlet')).not.toBeNull();
    });
});
