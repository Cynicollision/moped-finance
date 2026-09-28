import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Environment } from './../../../environments/environment';
import { DateProviderService } from './../date-provider.service';

/** The Demo Mode or Debug Mode badge (APP-4.1, APP-4.2). Renders nothing in a normal build. */
@Component({
    selector: 'app-mode-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule],
    templateUrl: './mode-badge.component.html',
    styleUrl: './mode-badge.component.scss'
})
export class ModeBadgeComponent {
    private dateProvider = inject(DateProviderService);

    /** Show only the icon, for the navigation rail and the page header on phones. */
    readonly iconOnly = input(false);

    readonly isDemoMode = Environment.demoMode;
    readonly isDebugMode = Environment.isDebugMode;

    readonly debugDateLabel = computed(() => this.dateProvider.today().replace(/-/g, ''));
}
