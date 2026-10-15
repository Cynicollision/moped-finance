import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppTheme } from '@shared/core/enum';
import { SettingsService } from './../../settings/settings.service';
import { AuthService } from './../auth.service';

/** Where the browser keeps a copy of the theme, which `public/theme.js` applies before the app draws. */
export const THEME_STORAGE_KEY = 'moped-finance-theme';

const THEMES: string[] = Object.values(AppTheme);

/**
 * The theme (SET-3.1). It's a setting stored with the instance; the browser keeps a copy so the next visit
 * starts in it, before anything has loaded. The theme is the `data-theme` attribute on `<html>`, which sets
 * `color-scheme`, which Material's colours and the app's tokens follow (`styles.scss`).
 */
@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly document = inject(DOCUMENT);
    private readonly authService = inject(AuthService);
    private readonly settingsService = inject(SettingsService);

    private readonly current = signal(this.readCopy());
    private readonly signedIn = computed(() => this.authService.currentUser() !== null);

    /** The chosen theme. */
    readonly theme = this.current.asReadonly();

    constructor() {
        this.apply(this.current());

        // Once signed in, follow the stored setting, which may have changed on another device.
        effect(() => {
            if (this.signedIn()) {
                untracked(() => this.loadStored());
            }
        });
    }

    /** Shows `theme` straight away and stores it, putting the previous one back if that fails. */
    async save(theme: AppTheme): Promise<boolean> {
        const previous = this.current();
        this.set(theme);
        const saved = await this.settingsService.save({ theme });
        if (!saved) {
            this.set(previous);
            return false;
        }
        return true;
    }

    private async loadStored(): Promise<void> {
        try {
            const { theme } = await this.settingsService.fetch();
            if (THEMES.includes(theme)) {
                this.set(theme);
            }
        } catch {
            // Keep the browser's copy. Screens that need the server report it themselves.
        }
    }

    private set(theme: AppTheme): void {
        this.apply(theme);
        this.current.set(theme);
    }

    private apply(theme: AppTheme): void {
        // Only on a change: charts redraw whenever the attribute is written
        const root = this.document.documentElement;
        if (root.getAttribute('data-theme') !== theme) {
            root.setAttribute('data-theme', theme);
        }
        try {
            this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Storage can be blocked; the theme still applies once the setting loads.
        }
    }

    private readCopy(): AppTheme {
        try {
            const theme = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
            if (theme && THEMES.includes(theme)) {
                return theme as AppTheme;
            }
        } catch {
            // As above
        }
        return AppTheme.Dark;
    }
}
