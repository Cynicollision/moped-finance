import { Tick } from 'chart.js';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Labels for a chart's axes and tooltips. */
export class ChartFormat {
    /**
     * Money axis labels in short form ("$34.25K", "-$1.2M"), with just enough decimals that no two read the
     * same (ACCT-2.12): ticks 50 apart around $34K need two, where $200K apart need none.
     */
    static moneyLabels(values: number[]): string[] {
        let labels: string[] = [];
        for (let digits = 0; digits <= 3; digits++) {
            const format = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
            labels = values.map(value => format.format(value));
            if (new Set(labels).size === labels.length) {
                break;
            }
        }
        return labels;
    }

    /** A money axis's tick callback (`scales.y.ticks.callback`), labelling every tick with `moneyLabels`. */
    static moneyTick(_value: number | string, index: number, ticks: Tick[]): string {
        return ChartFormat.moneyLabels(ticks.map(tick => tick.value))[index];
    }

    /** An amount in full ("$34,231.50"), for tooltips. */
    static money(value: number): string {
        return currency.format(value);
    }
}
