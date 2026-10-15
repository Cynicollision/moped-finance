import { Injectable, inject } from '@angular/core';
import { AppSettings } from '@shared/core/types';
import { ApiService } from './../core/api.service';

/** The instance's settings (SET-1.2). */
@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private api = inject(ApiService);

    fetch(): Promise<AppSettings> {
        return this.api.load<AppSettings>('api/v1/settings');
    }

    /** Saves the settings in `changes`; the others keep their values. */
    save(changes: Partial<AppSettings>): Promise<AppSettings | undefined> {
        return this.api.put<AppSettings>('api/v1/settings', changes);
    }
}
