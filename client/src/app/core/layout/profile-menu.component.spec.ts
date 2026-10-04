import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './../auth.service';
import { ProfileMenuComponent } from './profile-menu.component';

describe('ProfileMenuComponent', () => {
    async function openMenu(displayName: string) {
        const authService = { currentUser: signal({ id: '1', displayName, username: 'ada' }), logout: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ProfileMenuComponent],
            providers: [provideRouter([]), { provide: AuthService, useValue: authService }]
        });

        const fixture = TestBed.createComponent(ProfileMenuComponent);
        await fixture.whenStable();
        (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
        await fixture.whenStable();
        // The menu renders in an overlay attached to the document body.
        const items = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'));
        return { fixture, items, authService };
    }

    afterEach(() => {
        document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
    });

    it('APP-1.4 should show initials from the first two words of the display name', async () => {
        const { fixture } = await openMenu('Ada King Lovelace');

        expect((fixture.nativeElement as HTMLElement).querySelector('.avatar')!.textContent).toBe('AK');
    });

    it('APP-1.5 should offer Institutions, Categories, Settings and Sign out', async () => {
        const { items } = await openMenu('Ada Lovelace');

        expect(
            items.map(item => [item.querySelector('mat-icon + span')!.textContent, item.getAttribute('href')])
        ).toEqual([
            ['Institutions', '/settings/institutions'],
            ['Categories', '/settings/categories'],
            ['Settings', '/settings'],
            ['Sign out', null]
        ]);
    });

    it('APP-1.5 should sign out from the menu', async () => {
        const { items, authService } = await openMenu('Ada Lovelace');

        items.at(-1)!.click();

        expect(authService.logout).toHaveBeenCalled();
    });
});
