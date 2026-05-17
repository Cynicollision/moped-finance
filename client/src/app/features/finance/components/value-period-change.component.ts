import { Component, Input } from '@angular/core';
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
    @Input({ required: true }) amount!: number;
    @Input({ required: true }) percentage!: number;
    @Input({ required: true }) isPositive!: boolean;
    @Input({ required: true }) isGood!: boolean;
    @Input() label: string | undefined;
}
