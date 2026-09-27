import { Component, Input, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-value-period-change',
    standalone: true,
    imports: [CurrencyPipe, DecimalPipe, MatIconModule],
    templateUrl: './value-period-change.component.html',
    styles: []
})
export class FinanceValuePeriodChangeComponent {
    readonly amount = input.required<number>();
    readonly percentage = input.required<number>();
    readonly isPositive = input.required<boolean>();
    readonly isGood = input.required<boolean>();
    @Input() label: string | undefined;
}
