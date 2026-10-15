import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppTheme } from '@shared/core/enum';
import { NotificationService } from './../core/notification.service';
import { ThemeService } from './../core/theme/theme.service';
import { AppearanceComponent } from './appearance.component';

describe('AppearanceComponent', () => {
    async function render(save = vi.fn().mockResolvedValue(true)) {
        const theme = signal(AppTheme.Dark);
        const themeService = { theme, save };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [AppearanceComponent],
            providers: [
                provideRouter([]),
                { provide: ThemeService, useValue: themeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(AppearanceComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const radios = () => Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
        return { fixture, element, radios, themeService, notificationService };
    }

    it('SET-3.1 should offer Dark, Light and Match system, with the current theme chosen', async () => {
        const { element, radios } = await render();

        expect(Array.from(element.querySelectorAll('mat-radio-button label')).map(l => l.textContent!.trim())).toEqual([
            'Dark',
            'Light',
            "Match system Follows your device's light or dark setting"
        ]);
        expect(radios().map(radio => radio.checked)).toEqual([true, false, false]);
    });

    it('SET-3.1 should apply and store a theme as soon as it is chosen', async () => {
        const { fixture, radios, themeService, notificationService } = await render();

        radios()[1].click();
        await fixture.whenStable();

        expect(themeService.save).toHaveBeenCalledWith(AppTheme.Light);
        expect(notificationService.success).toHaveBeenCalledWith('Theme saved');
    });

    it('SET-3.1 should go back to the theme showing when storing fails', async () => {
        // Answer once the choice has drawn, as a request to the server would
        let answer!: (saved: boolean) => void;
        const saved = new Promise<boolean>(resolve => (answer = resolve));
        const { fixture, radios, notificationService } = await render(vi.fn().mockReturnValue(saved));

        radios()[2].click();
        await fixture.whenStable();
        answer(false);
        await saved;
        await fixture.whenStable();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(radios().map(radio => radio.checked)).toEqual([true, false, false]);
    });
});
