import { TestBed } from '@angular/core/testing';
import { HistoryTimeframe } from '@shared/core/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { ValueHistoryComponent } from './value-history.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('ValueHistoryComponent', () => {
    // Each day's amount defaults to its position, so every day is a change.
    function create(dates: string[], amounts: number[] = dates.map((_, i) => i)) {
        const fixture = TestBed.createComponent(ValueHistoryComponent);
        fixture.componentRef.setInput(
            'historyData',
            dates.map((date, i) => ({ date, amount: amounts[i], type: ValueHistoryType.NetWorth }))
        );
        fixture.componentRef.setInput('chartTypeOptions', []);
        fixture.componentRef.setInput('selectedChartType', ValueHistoryType.NetWorth);
        fixture.componentRef.setInput('selectedTimeframe', HistoryTimeframe.PastThirtyDays);
        return fixture.componentInstance;
    }

    it("DASH-1.1 should label the chart with each entry's own date, oldest first", () => {
        const history = create(['2026-05-02', '2026-04-30', '2026-05-01']);

        expect(history.chartConfig()!.data.labels).toEqual(['Apr 30', 'May 1', 'May 2']);
    });

    it('ACCT-2.11 DASH-1.4 should plot the first day, each day the value changes, and the last', () => {
        const history = create(
            ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06'],
            [100, 100, 100, 200, 200, 200]
        );

        expect(history.chartConfig()!.data.labels).toEqual(['May 1', 'May 4', 'May 6']);
        expect(history.chartConfig()!.data.datasets[0].data).toEqual([100, 200, 200]);
    });

    it('DASH-1.1 should label by month over more than six months', () => {
        const history = create(['2026-05-01', '2025-06-01']);

        expect(history.chartConfig()!.data.labels).toEqual(["Jun '25", "May '26"]);
    });

    async function render(chartTypeOptions: { value: ValueHistoryType; label: string }[]) {
        const fixture = TestBed.createComponent(ValueHistoryComponent);
        fixture.componentRef.setInput('historyData', [
            { date: '2026-05-01', amount: 1, type: ValueHistoryType.NetWorth },
            { date: '2026-05-02', amount: 2, type: ValueHistoryType.NetWorth }
        ]);
        fixture.componentRef.setInput('chartTypeOptions', chartTypeOptions);
        fixture.componentRef.setInput('selectedChartType', chartTypeOptions[0].value);
        fixture.componentRef.setInput('selectedTimeframe', HistoryTimeframe.PastThirtyDays);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    const viewTypes = [
        { value: ValueHistoryType.NetWorth, label: 'Net Worth' },
        { value: ValueHistoryType.Assets, label: 'Total Assets' },
        { value: ValueHistoryType.Liabilities, label: 'Total Liabilities' }
    ];

    it('DASH-1.1 should choose the View Type from the title', async () => {
        const { fixture, element } = await render(viewTypes);
        const chosen: ValueHistoryType[] = [];
        fixture.componentInstance.chartTypeChange.subscribe(type => chosen.push(type));

        const title = element.querySelector<HTMLButtonElement>('.chart-type-trigger')!;
        expect(title.textContent).toContain('Net Worth');
        expect(element.querySelector('mat-select')).toBeNull();

        title.click();
        await fixture.whenStable();
        const items = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'));
        expect(items.map(item => item.querySelector('span')!.textContent)).toEqual([
            'Net Worth',
            'Total Assets',
            'Total Liabilities'
        ]);
        items[1].click();

        expect(chosen).toEqual([ValueHistoryType.Assets]);
        document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
    });

    it('ACCT-2.3 should show a plain title when there is only one view type', async () => {
        const { element } = await render([viewTypes[1]]);

        expect(element.querySelector('.chart-type-trigger')).toBeNull();
        expect(element.querySelector('.chart-title')!.textContent).toContain('Total Assets');
    });

    it('DASH-1.2 ACCT-2.4 should offer the timeframes, up to 10 years, as short buttons below the chart', async () => {
        const { fixture, element } = await render(viewTypes);
        const chosen: HistoryTimeframe[] = [];
        fixture.componentInstance.timeframeChange.subscribe(timeframe => chosen.push(timeframe));

        const toggles = Array.from(element.querySelectorAll<HTMLButtonElement>('.timeframes button'));
        expect(toggles.map(toggle => toggle.textContent!.trim())).toEqual([
            '30D',
            '60D',
            '90D',
            'YTD',
            '1Y',
            '2Y',
            '5Y',
            '10Y',
            'All'
        ]);
        expect(toggles[4].getAttribute('aria-label')).toBe('Past Year');
        expect(
            element.querySelector('.chart-wrapper')!.compareDocumentPosition(element.querySelector('.timeframes')!)
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        toggles[4].click();

        expect(chosen).toEqual([HistoryTimeframe.PastOneYear]);
    });
});
