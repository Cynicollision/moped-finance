import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './../auth.service';
import { DateProviderService } from './../date-provider.service';
import { LayoutService, SizeClass } from './layout.service';
import { Crumb, PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
    async function render(
        title: string,
        crumbs: Crumb[],
        sizeClass: SizeClass = 'expanded',
        refreshing = false
    ): Promise<HTMLElement> {
        const size = signal(sizeClass);
        TestBed.configureTestingModule({
            imports: [PageHeaderComponent],
            providers: [
                provideRouter([]),
                {
                    provide: LayoutService,
                    useValue: { sizeClass: size, isCompact: computed(() => size() === 'compact') }
                },
                {
                    provide: AuthService,
                    useValue: { currentUser: signal({ id: '1', displayName: 'Ada Lovelace', username: 'ada' }) }
                },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });

        const fixture = TestBed.createComponent(PageHeaderComponent);
        fixture.componentRef.setInput('title', title);
        fixture.componentRef.setInput('crumbs', crumbs);
        fixture.componentRef.setInput('refreshing', refreshing);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    it('APP-2.1 should show a progress bar under the header only while the screen refreshes', async () => {
        expect((await render('Dashboard', [])).querySelector('mat-progress-bar')).toBeNull();

        TestBed.resetTestingModule();
        expect((await render('Dashboard', [], 'expanded', true)).querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('APP-1.3 should show the title as the page heading, with no trail on a top-level screen', async () => {
        const element = await render('Transactions', []);

        expect(element.querySelector('h1')!.textContent!.trim()).toBe('Transactions');
        expect(element.querySelector('nav.crumbs')).toBeNull();
        expect(element.querySelector('a.back')).toBeNull();
    });

    it('APP-1.8 should link every crumb above the title, in order', async () => {
        const element = await render('Edit Institution', [
            { label: 'Settings', link: '/settings' },
            { label: 'Institutions', link: '/settings/institutions' },
            { label: 'First Bank', link: ['/settings/institutions', 'inst-1'] }
        ]);

        const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav.crumbs a')).map(link => [
            link.textContent,
            link.getAttribute('href')
        ]);
        expect(links).toEqual([
            ['Settings', '/settings'],
            ['Institutions', '/settings/institutions'],
            ['First Bank', '/settings/institutions/inst-1']
        ]);
        expect(element.querySelector('h1')!.textContent!.trim()).toBe('Edit Institution');
    });

    it('APP-1.8 should give phones a back arrow to the last crumb', async () => {
        const element = await render(
            'Import Balance History',
            [
                { label: 'Dashboard', link: '/dashboard' },
                { label: 'Checking', link: ['/accounts', 'acct-1'] }
            ],
            'compact'
        );

        const back = element.querySelector<HTMLAnchorElement>('a.back')!;
        expect(back.getAttribute('href')).toBe('/accounts/acct-1');
        expect(back.getAttribute('aria-label')).toBe('Back to Checking');
    });

    it('APP-1.4 should hold the profile control on phones only', async () => {
        const phone = await render('Dashboard', [], 'compact');
        expect(phone.querySelector('.avatar')!.textContent).toBe('AL');

        TestBed.resetTestingModule();
        const desktop = await render('Dashboard', [], 'expanded');
        expect(desktop.querySelector('.avatar')).toBeNull();
    });
});
