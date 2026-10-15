import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PasswordRules } from '@shared/core/util';

/**
 * The password rules under a new password's field, each marked met or not as the user types (AUTH-9.4).
 * The server checks the same rules (`PasswordRules`).
 */
@Component({
    selector: 'app-password-rules',
    imports: [MatIconModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './password-rules.component.html',
    styleUrl: './password-rules.component.scss'
})
export class PasswordRulesComponent {
    readonly password = input.required<string>();
    readonly username = input.required<string>();

    readonly checks = computed(() =>
        PasswordRules.check(this.password(), this.username()).filter(check => check.alwaysListed || !check.met)
    );
}
