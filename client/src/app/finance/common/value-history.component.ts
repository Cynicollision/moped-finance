import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { HistoryTimeframe } from '@shared/core/enum';
import { CalendarDateUtil } from '@shared/core/util';
import { ValueHistoryType } from '@shared/finance/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ChartComponent, ChartConfiguration } from './../../core/chart.component';
import { FinanceValuePeriodChangeComponent, ValuePeriodChange } from './value-period-change.component';

export interface ChartTypeOption {
    value: ValueHistoryType;
    label: string;
}

export interface TimeframeOption {
    value: HistoryTimeframe;
    /** The name, as shown after the period change ("Past 30 Days"). */
    label: string;
    /** The button text under the chart ("30D"). */
    shortLabel: string;
}

/** The timeframes offered under the chart (DASH-1.2, ACCT-2.4), shortest first. */
export const TimeframeOptions: TimeframeOption[] = [
    { value: HistoryTimeframe.PastThirtyDays, label: 'Past 30 Days', shortLabel: '30D' },
    { value: HistoryTimeframe.PastSixtyDays, label: 'Past 60 Days', shortLabel: '60D' },
    { value: HistoryTimeframe.PastNinetyDays, label: 'Past 90 Days', shortLabel: '90D' },
    { value: HistoryTimeframe.YearToDate, label: 'Year To Date', shortLabel: 'YTD' },
    { value: HistoryTimeframe.PastOneYear, label: 'Past Year', shortLabel: '1Y' },
    { value: HistoryTimeframe.PastTwoYears, label: 'Past 2 Years', shortLabel: '2Y' },
    { value: HistoryTimeframe.All, label: 'All Time', shortLabel: 'All' }
];

@Component({
    selector: 'app-value-history',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        MatButtonToggleModule,
        MatCardModule,
        MatIconModule,
        MatMenuModule,
        ChartComponent,
        FinanceValuePeriodChangeComponent
    ],
    templateUrl: './value-history.component.html',
    styleUrl: './value-history.component.scss'
})
export class FinanceValueHistoryComponent {
    readonly historyData = input.required<TotalValueHistory[]>();
    readonly title = input<string>();
    readonly currentValue = input(0);

    // Configurable Options
    readonly chartTypeOptions = input.required<ChartTypeOption[]>();
    readonly timeframeOptions = input<TimeframeOption[]>(TimeframeOptions);

    // Current Selections
    readonly selectedChartType = input.required<ValueHistoryType>();
    readonly selectedTimeframe = input.required<HistoryTimeframe>();

    readonly chartTypeChange = output<ValueHistoryType>();
    readonly timeframeChange = output<HistoryTimeframe>();

    // Computed Properties
    readonly selectedChartLabel = computed(() => {
        const title = this.title();
        if (title) {
            return title;
        }
        return this.chartTypeOptions().find(o => o.value === this.selectedChartType())?.label || 'History';
    });

    readonly chartConfig = computed<ChartConfiguration | undefined>(() => {
        const data = this.historyData();
        if (data.length === 0) {
            return undefined;
        }

        // Sort ascending by date for the chart (left to right)
        const ascendingData = [...data].sort((a, b) => a.date.localeCompare(b.date));

        const type = this.selectedChartType();
        const label = this.selectedChartLabel();

        // Determine label format based on timeframe duration
        const firstDate = ascendingData[0].date;
        const lastDate = ascendingData[ascendingData.length - 1].date;
        const isLongTimeframe = CalendarDateUtil.addMonths(firstDate, 6) < lastDate;

        // Use Intl.DateTimeFormat for clean "Jun 12" displays
        const shortFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });

        return {
            type: 'line',
            data: {
                labels: ascendingData.map(d => {
                    const date = CalendarDateUtil.toDate(d.date);
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
                                    if (formatted.endsWith('.0')) {
                                        formatted = formatted.slice(0, -2);
                                    }
                                    return sign + '$' + formatted + 'M';
                                }
                                else if (absNum >= 1000) {
                                    let formatted = (absNum / 1000).toFixed(1);
                                    if (formatted.endsWith('.0')) {
                                        formatted = formatted.slice(0, -2);
                                    }
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

    readonly periodChange = computed<(ValuePeriodChange & { timeframeLabel: string }) | undefined>(() => {
        const data = this.historyData();
        if (data.length < 2) {
            return undefined;
        }

        // historyData comes sorted from the API by default, but double check first/last
        const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const startValue = sortedData[0].amount;
        const endValue = sortedData[sortedData.length - 1].amount;

        // Base case: check the raw numeric difference
        const changeAmount = endValue - startValue;
        const changePercentage = startValue !== 0 ? (changeAmount / Math.abs(startValue)) * 100 : 0;

        let isPositive = changeAmount >= 0;
        let isGood = isPositive;

        if (this.selectedChartType() === ValueHistoryType.Liabilities) {
            // Liabilities are stored as negative numbers (or we are evaluating their absolute magnitude).
            // A decrease towards 0 means the numeric value is technically INCREASING (e.g., -5000 to -1000).
            // However, the user expects to see:
            // - Debt shrinking towards $0: DOWN arrow (isPositive = false) AND Green (isGood = true)
            // - Debt growing away from $0: UP arrow (isPositive = true) AND Red (isGood = false)

            // To achieve this, if the numeric value INCREASES (debt shrinks), the arrow goes DOWN.
            isPositive = changeAmount < 0;
            isGood = !isPositive;
        }

        const timeframeLabel = this.timeframeOptions().find(t => t.value === this.selectedTimeframe())?.label || 'Period';

        return {
            amount: Math.abs(changeAmount), // Absolute value for display (- is handled by arrow/positivity)
            percentage: Math.abs(changePercentage),
            isPositive,
            isGood,
            timeframeLabel
        };
    });
}
