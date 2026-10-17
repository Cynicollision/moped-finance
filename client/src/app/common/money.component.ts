import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatCurrency, getCurrencySymbol } from '@angular/common';

/**
 * How an amount shows its sign and colour (APP-6):
 * - `plain`: the signed amount ("-$3,734.00") in the ordinary text colour. Balances, budget amounts, and expenses
 *   shown as a positive number.
 * - `transaction`: money in as "+$1,250.00" in green, money out as "$45.12" with no sign in the ordinary text
 *   colour (APP-6.2).
 * - `favourable`: green when zero or more, red and signed when negative (income, savings).
 */
export type MoneyTone = 'plain' | 'transaction' | 'favourable';

/** An amount of money, formatted and coloured the same way everywhere (APP-6.1, APP-6.2). */
@Component({
    selector: 'app-money',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './money.component.html',
    styleUrl: './money.component.scss'
})
export class MoneyComponent {
    private readonly locale = inject(LOCALE_ID);

    readonly amount = input.required<number>();
    readonly tone = input<MoneyTone>('plain');
    /** Angular's digits format: '1.0-0' for whole dollars. */
    readonly digits = input('1.2-2');

    readonly text = computed(() => {
        const amount = this.amount();
        const size = formatCurrency(
            Math.abs(amount),
            this.locale,
            getCurrencySymbol('USD', 'narrow', this.locale),
            'USD',
            this.digits()
        );
        if (this.tone() === 'transaction') {
            return amount > 0 ? `+${size}` : size;
        }
        return amount < 0 ? `-${size}` : size;
    });

    readonly colour = computed<'positive' | 'negative' | undefined>(() => {
        const amount = this.amount();
        switch (this.tone()) {
            case 'transaction':
                return amount > 0 ? 'positive' : undefined;
            case 'favourable':
                return amount < 0 ? 'negative' : 'positive';
            default:
                return undefined;
        }
    });
}
