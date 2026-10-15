import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { AppTheme } from '@shared/core/enum';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { NotificationService } from './../core/notification.service';
import { ThemeService } from './../core/theme/theme.service';

// The Appearance page of Settings (SET-3.1). The theme applies as soon as it's chosen.
@Component({
    selector: 'app-appearance',
    imports: [MatCardModule, MatRadioModule, PageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './appearance.component.html',
    styleUrl: './appearance.component.scss'
})
export class AppearanceComponent {
    private themeService = inject(ThemeService);
    private notificationService = inject(NotificationService);

    /** The option chosen: the theme showing, or one being stored. */
    readonly selected = linkedSignal(() => this.themeService.theme());
    readonly saving = signal(false);

    readonly themeOptions = [
        { value: AppTheme.Dark, label: 'Dark' },
        { value: AppTheme.Light, label: 'Light' },
        { value: AppTheme.System, label: 'Match system', hint: "Follows your device's light or dark setting" }
    ];

    async onThemeChange(change: MatRadioChange<AppTheme>) {
        this.selected.set(change.value);
        this.saving.set(true);
        const saved = await this.themeService.save(change.value);
        this.saving.set(false);
        if (saved) {
            this.notificationService.success('Theme saved');
        } else {
            this.selected.set(this.themeService.theme());
        }
    }
}
