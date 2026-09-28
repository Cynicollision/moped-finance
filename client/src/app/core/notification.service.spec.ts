import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LayoutService, SizeClass } from './layout/layout.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
    function setup(sizeClass: SizeClass, hasBottomNav: boolean) {
        const size = signal(sizeClass);
        const snackBar = { open: vi.fn() };
        TestBed.configureTestingModule({
            providers: [
                { provide: MatSnackBar, useValue: snackBar },
                {
                    provide: LayoutService,
                    useValue: { sizeClass: size, isCompact: computed(() => size() === 'compact'), hasBottomNav: signal(hasBottomNav) }
                }
            ]
        });
        return { service: TestBed.inject(NotificationService), snackBar };
    }

    it('APP-2.8 should show success at the bottom right on larger screens for 4 seconds, with no action', () => {
        const { service, snackBar } = setup('expanded', false);

        service.success('Account saved');

        expect(snackBar.open).toHaveBeenCalledWith('Account saved', undefined, {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
            panelClass: []
        });
    });

    it('APP-2.8 should centre messages on phones, above the bottom navigation', () => {
        const { service, snackBar } = setup('compact', true);

        service.success('Account saved');

        expect(snackBar.open).toHaveBeenCalledWith('Account saved', undefined, expect.objectContaining({
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['snackbar-above-bottom-nav']
        }));
    });

    it('APP-2.2 should show an error for 5 seconds with a Close button', () => {
        const { service, snackBar } = setup('compact', false);

        service.error('Network or server error encountered.');

        expect(snackBar.open).toHaveBeenCalledWith('Network or server error encountered.', 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['snackbar-error']
        });
    });
});
