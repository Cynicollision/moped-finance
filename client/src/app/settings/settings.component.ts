import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ApiTokensComponent } from './api-tokens.component';

// The Settings screen (SET-1.1). Sections not built yet are left out.
@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [ApiTokensComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss'
})
export class SettingsComponent { }
