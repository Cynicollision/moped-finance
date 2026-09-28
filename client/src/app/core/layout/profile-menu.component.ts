import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from './../auth.service';

/**
 * The profile control (APP-1.4) and its menu (APP-1.5). `full` shows the initials
 * and display name, at the bottom of the side navigation; `avatar` shows only the initials, at the bottom of
 * the navigation rail and in the page header on phones.
 */
@Component({
    selector: 'app-profile-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, MatDividerModule, MatIconModule, MatMenuModule],
    templateUrl: './profile-menu.component.html',
    styleUrl: './profile-menu.component.scss'
})
export class ProfileMenuComponent {
    private authService = inject(AuthService);

    readonly variant = input<'full' | 'avatar'>('full');
    /** Open the menu upwards, for a control at the bottom of the screen. */
    readonly above = input(false);

    readonly displayName = computed(() => this.authService.currentUser()?.displayName ?? '');

    readonly initials = computed(() => {
        const words = this.displayName().split(' ').filter(word => word.length > 0);
        if (words.length === 0) {
            return '?';
        }
        return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    });

    logout() {
        this.authService.logout();
    }
}
