import { TestBed } from '@angular/core/testing';
import { HistoryTimeframe } from '@shared/core/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { FinanceValueHistoryComponent } from './value-history.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('FinanceValueHistoryComponent', () => {
    function create(dates: string[]) {
        const fixture = TestBed.createComponent(FinanceValueHistoryComponent);
        fixture.componentRef.setInput('historyData', dates.map(date => ({ date, amount: 1, type: ValueHistoryType.NetWorth })));
        fixture.componentRef.setInput('chartTypeOptions', []);
        fixture.componentRef.setInput('selectedChartType', ValueHistoryType.NetWorth);
        fixture.componentRef.setInput('selectedTimeframe', HistoryTimeframe.PastThirtyDays);
        return fixture.componentInstance;
    }

    it('DASH-1.1 should label the chart with each entry\'s own date, oldest first', () => {
        const history = create(['2026-05-02', '2026-04-30', '2026-05-01']);

        expect(history.chartConfig()!.data.labels).toEqual(['Apr 30', 'May 1', 'May 2']);
    });

    it('DASH-1.1 should label by month over more than six months', () => {
        const history = create(['2026-05-01', '2025-06-01']);

        expect(history.chartConfig()!.data.labels).toEqual(['Jun \'25', 'May \'26']);
    });
});
