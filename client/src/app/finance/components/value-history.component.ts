import { Component, Input, Output, EventEmitter, computed, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { HistoryTimeframe } from '@shared/common/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ChartComponent, ChartConfiguration } from './../../core/chart.component';
import { FinanceValuePeriodChangeComponent } from './value-period-change.component';

export interface ChartTypeOption {
    value: ValueHistoryType;
    label: string;
}

@Component({
    selector: 'app-value-history',
    standalone: true,
    imports: [
        CurrencyPipe,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatIconModule,
        ChartComponent,
        FinanceValuePeriodChangeComponent
    ],
    templateUrl: './value-history.component.html',
    styleUrl: './value-history.component.scss'
})
export class FinanceValueHistoryComponent implements OnChanges {
    // Inputs
    @Input({ required: true }) historyData: TotalValueHistory[] = [];
    @Input() title: string | undefined;
    @Input() currentValue: number = 0;

    // Configurable Options
    @Input({ required: true }) chartTypeOptions: ChartTypeOption[] = [];
    @Input() timeframeOptions = [
        { value: HistoryTimeframe.PastThirtyDays, label: 'Past 30 Days' },
        { value: HistoryTimeframe.PastSixtyDays, label: 'Past 60 Days' },
        { value: HistoryTimeframe.PastNinetyDays, label: 'Past 90 Days' },
        { value: HistoryTimeframe.PastOneYear, label: 'Past Year' },
        { value: HistoryTimeframe.PastTwoYears, label: 'Past 2 Years' },
        { value: HistoryTimeframe.YearToDate, label: 'Year To Date' },
        { value: HistoryTimeframe.All, label: 'All Time' }
    ];

    // Current Selections
    @Input({ required: true }) selectedChartType!: ValueHistoryType;
    @Input({ required: true }) selectedTimeframe!: HistoryTimeframe;

    // Outputs
    @Output() chartTypeChange = new EventEmitter<ValueHistoryType>();
    @Output() timeframeChange = new EventEmitter<HistoryTimeframe>();

    // Internal Signals mapped from Inputs
    historyDataSignal = signal<TotalValueHistory[]>([]);
    chartTypeOptionsSignal = signal<ChartTypeOption[]>([]);
    selectedChartTypeSignal = signal<ValueHistoryType | undefined>(undefined);
    selectedTimeframeSignal = signal<HistoryTimeframe | undefined>(undefined);

    ngOnChanges(changes: SimpleChanges) {
        if (changes['historyData']) {
            this.historyDataSignal.set(this.historyData || []);
        }
        if (changes['chartTypeOptions']) {
            this.chartTypeOptionsSignal.set(this.chartTypeOptions || []);
        }
        if (changes['selectedChartType']) {
            this.selectedChartTypeSignal.set(this.selectedChartType);
        }
        if (changes['selectedTimeframe']) {
            this.selectedTimeframeSignal.set(this.selectedTimeframe);
        }
    }

    // Handlers
    onChartTypeChange(value: ValueHistoryType) {
        this.chartTypeChange.emit(value);
    }

    onTimeframeChange(value: HistoryTimeframe) {
        this.timeframeChange.emit(value);
    }

    // Computed Properties
    selectedChartLabel = computed(() => {
        if (this.title) return this.title;
        return this.chartTypeOptionsSignal().find(o => o.value === this.selectedChartTypeSignal())?.label || 'History';
    });

    chartConfig = computed<ChartConfiguration | undefined>(() => {
        const data = this.historyDataSignal();
        if (!data || data.length === 0) return undefined;

        // Sort ascending by date for the chart (left to right)
        const ascendingData = [...data].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const type = this.selectedChartTypeSignal();
        const label = this.selectedChartLabel();

        return {
            type: 'line',
            data: {
                labels: ascendingData.map(d => {
                    const date = new Date(d.date);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                }),
                datasets: [
                    {
                        label: label,
                        data: ascendingData.map(d => d.amount),
                        borderColor: '#81c784', // --color-positive
                        backgroundColor: 'rgba(129, 199, 132, 0.15)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    point: {
                        radius: 0
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 20
                        }
                    },
                    y: {
                        reverse: type === ValueHistoryType.Liabilities,
                        ticks: {
                            maxTicksLimit: 6,
                            callback: function (value) {
                                const num = Number(value);
                                const absNum = Math.abs(num);
                                const sign = num < 0 ? '-' : '';

                                if (absNum >= 1000000) {
                                    return sign + '$' + (absNum / 1000000).toFixed(1) + 'M';
                                } else if (absNum >= 1000) {
                                    return sign + '$' + (absNum / 1000).toFixed(1) + 'K';
                                }
                                return sign + '$' + absNum.toLocaleString();
                            }
                        }
                    }
                }
            }
        };
    });

    periodChange = computed(() => {
        const data = this.historyDataSignal();
        if (!data || data.length < 2) return undefined;

        // historyData comes sorted from the API by default, but double check first/last
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const startValue = sortedData[0].amount;
        const endValue = sortedData[sortedData.length - 1].amount;

        // Base case: check the raw numeric difference
        const changeAmount = endValue - startValue;
        const changePercentage = startValue !== 0 ? (changeAmount / Math.abs(startValue)) * 100 : 0;

        let isPositive = changeAmount >= 0;
        let isGood = isPositive;

        if (this.selectedChartTypeSignal() === ValueHistoryType.Liabilities) {
            // Liabilities are stored as negative numbers (or we are evaluating their absolute magnitude).
            // A decrease towards 0 means the numeric value is technically INCREASING (e.g., -5000 to -1000).
            // However, the user expects to see:
            // - Debt shrinking towards $0: DOWN arrow (isPositive = false) AND Green (isGood = true)
            // - Debt growing away from $0: UP arrow (isPositive = true) AND Red (isGood = false)

            // To achieve this, if the numeric value INCREASES (debt shrinks), the arrow goes DOWN.
            isPositive = changeAmount < 0;
            isGood = !isPositive;
        }

        const timeframeLabel = this.timeframeOptions.find(t => t.value === this.selectedTimeframeSignal())?.label || 'Period';

        return {
            amount: Math.abs(changeAmount), // Absolute value for display (- is handled by arrow/positivity)
            percentage: Math.abs(changePercentage),
            isPositive,
            isGood,
            timeframeLabel
        };
    });
}
