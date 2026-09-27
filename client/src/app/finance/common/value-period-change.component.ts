import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/** A value's change over a period, ready to display. */
export interface ValuePeriodChange {
    /** The size of the change, always positive; the arrow shows its direction. */
    amount: number;
    percentage: number;
    /** Whether the arrow points up. */
    isPositive: boolean;
    /** Whether the change is good for the user (green) or bad (red). */
    isGood: boolean;
}

@Component({
    selector: 'app-value-period-change',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CurrencyPipe, DecimalPipe, MatIconModule],
    templateUrl: './value-period-change.component.html',
    styleUrl: './value-period-change.component.scss'
})
export class FinanceValuePeriodChangeComponent {
    readonly change = input.required<ValuePeriodChange>();
    readonly label = input<string>();
}
