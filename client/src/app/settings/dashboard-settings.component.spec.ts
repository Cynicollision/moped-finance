import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationService } from './../core/notification.service';
import { DashboardSettingsComponent } from './dashboard-settings.component';
import { SettingsService } from './settings.service';

describe('DashboardSettingsComponent', () => {
    async function render(save = vi.fn().mockResolvedValue({ showRetirementGroup: false })) {
        const settingsService = {
            fetch: vi.fn().mockResolvedValue({ showRetirementGroup: true }),
            save
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [DashboardSettingsComponent],
            providers: [
                provideRouter([]),
                { provide: SettingsService, useValue: settingsService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(DashboardSettingsComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        return { fixture, element, settingsService, notificationService };
    }

    it('SET-5.1 should show Show Retirement as its own group, on by default', async () => {
        const { element } = await render();

        const toggle = element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!;
        expect(element.querySelector('mat-slide-toggle')!.textContent).toContain('Show Retirement as its own group');
        expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('SET-5.1 should save the option as soon as it is changed', async () => {
        const { fixture, element, settingsService, notificationService } = await render();

        settingsService.fetch.mockResolvedValue({ showRetirementGroup: false });
        element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
        await fixture.whenStable();

        expect(settingsService.save).toHaveBeenCalledWith({ showRetirementGroup: false });
        expect(notificationService.success).toHaveBeenCalledWith('Dashboard settings saved');
        expect(element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.getAttribute('aria-checked')).toBe(
            'false'
        );
    });

    it('SET-5.1 should put the option back when the save fails', async () => {
        const { fixture, element, notificationService } = await render(vi.fn().mockResolvedValue(undefined));

        element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
        await fixture.whenStable();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.getAttribute('aria-checked')).toBe(
            'true'
        );
    });
});
