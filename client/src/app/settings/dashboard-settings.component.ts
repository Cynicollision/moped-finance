import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppSettings } from '@shared/core/types';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { SkeletonComponent } from './../core/loading/skeleton.component';
import { viewResource } from './../core/loading/view-resource';
import { NotificationService } from './../core/notification.service';
import { SettingsService } from './settings.service';

/** The settings that are on or off. */
type ToggleSetting = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];

// The Dashboard page of Settings (SET-5.1). Each option saves as soon as it's changed.
@Component({
    selector: 'app-dashboard-settings',
    imports: [MatCardModule, MatSlideToggleModule, PageHeaderComponent, LoadErrorComponent, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dashboard-settings.component.html',
    styleUrl: './dashboard-settings.component.scss'
})
export class DashboardSettingsComponent {
    private settingsService = inject(SettingsService);
    private notificationService = inject(NotificationService);

    readonly settings = viewResource({ loader: () => this.settingsService.fetch() });
    readonly saving = signal(false);

    async toggle(setting: ToggleSetting, change: MatSlideToggleChange) {
        this.saving.set(true);
        const saved = await this.settingsService.save({ [setting]: change.checked });
        this.saving.set(false);
        if (saved) {
            this.notificationService.success('Dashboard settings saved');
            this.settings.reload();
        } else {
            // The toggle has already moved; put it back to what's stored
            change.source.checked = !change.checked;
        }
    }
}
