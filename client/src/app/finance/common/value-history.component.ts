import { Component, Input, Output, EventEmitter, computed, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { HistoryTimeframe } from '@shared/core/enum';
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
    @Input() currentValue = 0;

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
    readonly historyDataSignal = signal<TotalValueHistory[]>([]);
    readonly chartTypeOptionsSignal = signal<ChartTypeOption[]>([]);
    readonly selectedChartTypeSignal = signal<ValueHistoryType | undefined>(undefined);
    readonly selectedTimeframeSignal = signal<HistoryTimeframe | undefined>(undefined);

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
    readonly selectedChartLabel = computed(() => {
        if (this.title) return this.title;
        return this.chartTypeOptionsSignal().find(o => o.value === this.selectedChartTypeSignal())?.label || 'History';
    });

    readonly chartConfig = computed<ChartConfiguration | undefined>(() => {
        const data = this.historyDataSignal();
        if (!data || data.length === 0) return undefined;

        // Sort ascending by date for the chart (left to right)
        const ascendingData = [...data].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const type = this.selectedChartTypeSignal();
        const label = this.selectedChartLabel();

        // Determine label format based on timeframe duration
        const firstDate = new Date(ascendingData[0].date);
        const lastDate = new Date(ascendingData[ascendingData.length - 1].date);
        const diffDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24);
        const isLongTimeframe = diffDays > 180; // More than 6 months

        // Use Intl.DateTimeFormat for clean "Jun 12" displays
        const shortFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });

        return {
            type: 'line',
            data: {
                labels: ascendingData.map(d => {
                    const date = new Date(d.date);
                    if (isLongTimeframe) {
                        return `${shortMonthFormat.format(date)} '${date.getFullYear().toString().slice(-2)}`;
                    }
                    return shortFormat.format(date);
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
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                elements: {
                    point: {
                        radius: 0,
                        hitRadius: 10,
                        hoverRadius: 4
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: window.innerWidth < 1000 ? 5 : 8,
                            maxRotation: 0,
                            autoSkip: true
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
                                    let formatted = (absNum / 1000000).toFixed(1);
                                    if (formatted.endsWith('.0')) formatted = formatted.slice(0, -2);
                                    return sign + '$' + formatted + 'M';
                                } else if (absNum >= 1000) {
                                    let formatted = (absNum / 1000).toFixed(1);
                                    if (formatted.endsWith('.0')) formatted = formatted.slice(0, -2);
                                    return sign + '$' + formatted + 'K';
                                }
                                return sign + '$' + absNum.toLocaleString();
                            }
                        }
                    }
                }
            }
        };
    });

    readonly periodChange = computed(() => {
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
