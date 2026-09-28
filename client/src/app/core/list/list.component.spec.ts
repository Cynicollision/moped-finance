import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListColumn, ListModule, ListSort } from './list.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ListModule],
    template: `
        <app-list [columns]="columns" [sort]="sort()" (sortChange)="sort.set($event)">
            @for (row of rows; track row.id) {
                <a appListRow>
                    <span appListCell="date">{{ row.date }}</span>
                    <span appListCell="account">{{ row.account }}</span>
                    <span appListCell="merchant">{{ row.merchant }}</span>
                    <span appListCell="category">{{ row.category }}</span>
                    <span appListCell="amount">{{ row.amount }}</span>
                </a>
            }
        </app-list>
    `
})
class ListHostComponent {
    readonly columns: ListColumn[] = [
        { key: 'date', label: 'Date', width: '8rem', sort: 'desc', compact: 'secondary' },
        { key: 'account', label: 'Account' },
        { key: 'merchant', label: 'Merchant', sort: 'asc', compact: 'primary' },
        { key: 'category', label: 'Category', compact: 'secondary' },
        { key: 'amount', label: 'Amount', align: 'end', sort: 'asc', compact: 'trailing' }
    ];
    readonly rows = [{ id: 1, date: 'May 1', account: 'Checking', merchant: 'FreshMart', category: 'Groceries', amount: '$12.00' }];
    readonly sort = signal<ListSort>({ key: 'date', direction: 'desc' });
}

describe('ListComponent', () => {
    async function render() {
        const fixture = TestBed.createComponent(ListHostComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const list = element.querySelector<HTMLElement>('app-list')!;
        return { fixture, element, list };
    }

    it('APP-7.1 should lay rows out as columns when wide', async () => {
        const { list } = await render();

        expect(list.style.getPropertyValue('--list-areas')).toBe('"date account merchant category amount"');
        expect(list.style.getPropertyValue('--list-columns')).toBe('8rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)');
        const headings = Array.from(list.querySelectorAll('.app-list-header .app-list-cell')).map(cell => cell.textContent!.trim());
        expect(headings).toEqual(['Date arrow_downward', 'Account', 'Merchant arrow_upward', 'Category', 'Amount arrow_upward']);
    });

    it('APP-7.1 should put the primary cell over the secondary ones, and trailing cells beside both, when narrow', async () => {
        const { list } = await render();

        expect(list.style.getPropertyValue('--list-compact-areas')).toBe('"merchant merchant amount" "date category amount"');
        expect(list.style.getPropertyValue('--list-compact-columns')).toBe('auto minmax(0, 1fr) auto');
        const places = Array.from(list.querySelectorAll('a .app-list-cell')).map(cell => cell.getAttribute('data-compact'));
        expect(places).toEqual(['secondary', 'hidden', 'primary', 'secondary', 'trailing']);
    });

    it('APP-7.2 should sort a newly chosen column in its first direction, and reverse the current one', async () => {
        const { fixture, list } = await render();
        const heading = (label: string) => Array.from(list.querySelectorAll<HTMLButtonElement>('.app-list-header button'))
            .find(button => button.textContent!.includes(label))!;

        expect(list.querySelectorAll('.app-list-header button').length).toBe(3);

        heading('Merchant').click();
        await fixture.whenStable();
        expect(fixture.componentInstance.sort()).toEqual({ key: 'merchant', direction: 'asc' });
        expect(heading('Merchant').getAttribute('aria-label')).toBe('Sorted by Merchant, ascending');

        heading('Merchant').click();
        expect(fixture.componentInstance.sort()).toEqual({ key: 'merchant', direction: 'desc' });

        heading('Date').click();
        expect(fixture.componentInstance.sort()).toEqual({ key: 'date', direction: 'desc' });
    });

    it('APP-7.2 should offer the sortable columns in a sort menu for narrow screens', async () => {
        const { fixture, list } = await render();

        const trigger = list.querySelector<HTMLButtonElement>('.app-list-sort-bar button')!;
        expect(trigger.textContent!.replace(/\s+/g, ' ').trim()).toBe('sort Date arrow_downward');

        trigger.click();
        await fixture.whenStable();
        const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item'));
        expect(items.map(item => item.textContent!.replace(/arrow_(upward|downward)/, '').trim())).toEqual(['Date', 'Merchant', 'Amount']);

        items[2].click();
        expect(fixture.componentInstance.sort()).toEqual({ key: 'amount', direction: 'asc' });
    });
});
