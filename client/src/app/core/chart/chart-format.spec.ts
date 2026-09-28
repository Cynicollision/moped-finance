import { ChartFormat } from './chart-format';

describe('ChartFormat', () => {
    it('ACCT-2.12 should give neighbouring money ticks distinct labels', () => {
        expect(ChartFormat.moneyLabels([34200, 34250, 34300])).toEqual(['$34.20K', '$34.25K', '$34.30K']);
        expect(ChartFormat.moneyLabels([34000, 34100, 34200])).toEqual(['$34.0K', '$34.1K', '$34.2K']);
    });

    it('ACCT-2.12 should use no decimals where the ticks are already distinct', () => {
        expect(ChartFormat.moneyLabels([0, 200000, 400000, 600000, 800000, 1000000])).toEqual(['$0', '$200K', '$400K', '$600K', '$800K', '$1M']);
        expect(ChartFormat.moneyLabels([0, 250, 500])).toEqual(['$0', '$250', '$500']);
    });

    it('ACCT-2.12 should show a liability\'s negative ticks with a minus sign', () => {
        expect(ChartFormat.moneyLabels([-132600, -132550, -132500])).toEqual(['-$132.60K', '-$132.55K', '-$132.50K']);
    });

    it('should show a tooltip amount in full', () => {
        expect(ChartFormat.money(34231.5)).toBe('$34,231.50');
        expect(ChartFormat.money(-132516.44)).toBe('-$132,516.44');
    });
});
