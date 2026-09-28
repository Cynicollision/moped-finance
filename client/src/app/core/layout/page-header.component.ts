import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LayoutService } from './layout.service';
import { ModeBadgeComponent } from './mode-badge.component';
import { ProfileMenuComponent } from './profile-menu.component';

/** A link in the breadcrumb trail above a page's title: a screen the page sits below (APP-1.8). */
export interface Crumb {
    label: string;
    link: string | unknown[];
}

/**
 * Every screen's header (APP-1.3): the breadcrumb trail, the title, and the screen's actions, projected as
 * content (a primary button and/or an overflow menu). On phones the trail becomes a back arrow to its last
 * crumb, and the header also holds the profile control, which the bottom navigation has no room for.
 */
@Component({
    selector: 'app-page-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, ModeBadgeComponent, ProfileMenuComponent],
    templateUrl: './page-header.component.html',
    styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
    private layout = inject(LayoutService);

    readonly title = input.required<string>();
    readonly crumbs = input<Crumb[]>([]);
    /** Show a thin progress bar under the header while the screen reloads data it's already showing (APP-2.1). */
    readonly refreshing = input(false);

    readonly parent = computed(() => this.crumbs().at(-1) ?? null);
    readonly isCompact = this.layout.isCompact;
}
