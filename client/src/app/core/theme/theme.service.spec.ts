import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppTheme } from '@shared/core/enum';
import { User } from '@shared/core/types';
import { SettingsService } from './../../settings/settings.service';
import { AuthService } from './../auth.service';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
    const user = { id: 'user-1', username: 'ada', displayName: 'Ada' } as User;

    function create(options: { stored?: AppTheme; signedIn?: boolean; save?: ReturnType<typeof vi.fn> } = {}) {
        const settingsService = {
            fetch: vi.fn().mockResolvedValue({ theme: options.stored ?? AppTheme.Dark, showRetirementGroup: true }),
            save: options.save ?? vi.fn().mockImplementation(changes => Promise.resolve(changes))
        };
        const currentUser = signal<User | null>(options.signedIn ? user : null);
        TestBed.configureTestingModule({
            providers: [
                { provide: SettingsService, useValue: settingsService },
                { provide: AuthService, useValue: { currentUser } }
            ]
        });
        return { service: TestBed.inject(ThemeService), settingsService, currentUser };
    }

    const appliedTheme = () => document.documentElement.getAttribute('data-theme');

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('SET-3.1 should start dark when the browser has no copy of the theme', () => {
        const { service } = create();

        expect(service.theme()).toBe(AppTheme.Dark);
        expect(appliedTheme()).toBe('Dark');
    });

    it("SET-3.1 should start in the browser's copy of the theme, before the setting loads", () => {
        localStorage.setItem(THEME_STORAGE_KEY, AppTheme.Light);

        const { service, settingsService } = create();

        expect(service.theme()).toBe(AppTheme.Light);
        expect(appliedTheme()).toBe('Light');
        expect(settingsService.fetch).not.toHaveBeenCalled();
    });

    it('SET-3.1 should follow the stored setting once signed in, and keep a copy of it', async () => {
        const { service, currentUser } = create({ stored: AppTheme.System });

        currentUser.set(user);
        TestBed.tick();
        await vi.waitFor(() => expect(service.theme()).toBe(AppTheme.System));

        expect(appliedTheme()).toBe('System');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('System');
    });

    it('SET-3.1 should apply a chosen theme straight away and store it', async () => {
        const { service, settingsService } = create();

        const saving = service.save(AppTheme.Light);
        expect(appliedTheme()).toBe('Light');

        expect(await saving).toBe(true);
        expect(settingsService.save).toHaveBeenCalledWith({ theme: AppTheme.Light });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('Light');
    });

    it("APP-9.1 should point the title bar's theme-color at the theme's scheme", async () => {
        const metas = ['dark', 'light'].map(scheme => {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.dataset['scheme'] = scheme;
            document.head.append(meta);
            return meta;
        });
        const media = () => metas.map(meta => meta.getAttribute('media'));

        try {
            const { service } = create();
            expect(media()).toEqual(['all', 'not all']);

            await service.save(AppTheme.Light);
            expect(media()).toEqual(['not all', 'all']);

            await service.save(AppTheme.System);
            expect(media()).toEqual(['(prefers-color-scheme: dark)', '(prefers-color-scheme: light)']);
        } finally {
            metas.forEach(meta => meta.remove());
        }
    });

    it('SET-3.1 should put the previous theme back when storing fails', async () => {
        const { service } = create({ save: vi.fn().mockResolvedValue(undefined) });

        expect(await service.save(AppTheme.Light)).toBe(false);

        expect(service.theme()).toBe(AppTheme.Dark);
        expect(appliedTheme()).toBe('Dark');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('Dark');
    });
});
