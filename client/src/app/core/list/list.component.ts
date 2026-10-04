import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

/** Where a column's cell goes when the page area is narrow (APP-7.1). */
export type ListCompactPlace = 'primary' | 'secondary' | 'trailing' | 'hidden';

export type ListSortDirection = 'asc' | 'desc';

export interface ListColumn {
    /** Names the column. Its cells use it with `appListCell`, and it's a CSS grid area, so it must be an identifier. */
    key: string;
    /** The heading when the page area is wide, and the sort menu's entry. */
    label: string;
    /** The column's width when wide, as a grid track ('8rem', 'minmax(0, 2fr)'). Default: an equal share. */
    width?: string;
    /** 'end' for amounts and actions. */
    align?: 'start' | 'end';
    /**
     * When narrow: the first line (one column), the second line in smaller text, joined with "·", at the end of the
     * row across both lines (amounts, actions), or left out. Default: left out.
     */
    compact?: ListCompactPlace;
    /** Makes the column sortable, starting in this direction when it's chosen. */
    sort?: ListSortDirection;
}

export interface ListSort {
    key: string;
    direction: ListSortDirection;
}

/** A row of an `app-list`: an `<a>` when selecting it opens the record, otherwise a `<div>`. */
@Directive({
    selector: '[appListRow]',
    host: {
        class: 'app-list-row'
    }
})
export class ListRowDirective { }

/**
 * A heading inside an `app-list` that starts a run of rows, with its title and, at the end, a subtotal:
 * `<div appListSubheader><h3>Essential</h3><app-money ...></app-money></div>`.
 */
@Directive({
    selector: '[appListSubheader]',
    host: {
        class: 'app-list-subheader'
    }
})
export class ListSubheaderDirective { }

/** A cell of an `app-list` row, named by its column's key. */
@Directive({
    selector: '[appListCell]',
    host: {
        class: 'app-list-cell',
        '[style.grid-area]': 'appListCell()',
        '[class.app-list-end]': 'column()?.align === "end"',
        '[attr.data-compact]': 'column()?.compact ?? "hidden"'
    }
})
export class ListCellDirective {
    private readonly list = inject(ListComponent);

    readonly appListCell = input.required<string>();
    readonly column = computed(() => this.list.columns().find(c => c.key === this.appListCell()));
}

/**
 * A list of records that reads as a table when the page area is wide and as two-line rows when it's narrow, so it
 * never scrolls sideways (APP-7.1). Columns are declared once; rows are projected, each cell marked with the column
 * it belongs to:
 *
 *     <app-list [columns]="columns" [sort]="sort()" (sortChange)="onSort($event)">
 *         @for (t of transactions(); track t.id) {
 *             <a appListRow [routerLink]="['/transactions', t.id]">
 *                 <span appListCell="date">{{ t.date | date }}</span>
 *                 ...
 *             </a>
 *         }
 *     </app-list>
 *
 * Sorting is by the column headings when wide and a sort menu when narrow (APP-7.2); the screen does the sorting.
 * Styles aren't encapsulated, because they lay out the projected rows; every selector starts with `.app-list`.
 */
@Component({
    selector: 'app-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonModule, MatIconModule, MatMenuModule, ListCellDirective],
    templateUrl: './list.component.html',
    styleUrl: './list.component.scss',
    host: {
        class: 'app-list',
        '[style.--list-columns]': 'wideColumns()',
        '[style.--list-areas]': 'wideAreas()',
        '[style.--list-compact-columns]': 'compactColumns()',
        '[style.--list-compact-areas]': 'compactAreas()'
    }
})
export class ListComponent {
    readonly columns = input.required<ListColumn[]>();
    /** The current sort, shown on its heading and in the sort menu. */
    readonly sort = input<ListSort>();
    /** Whether to show the column headings when wide. */
    readonly showHeader = input(true);
    readonly sortChange = output<ListSort>();

    readonly sortableColumns = computed(() => this.columns().filter(c => c.sort));
    readonly sortColumn = computed(() => this.columns().find(c => c.key === this.sort()?.key));

    readonly wideColumns = computed(() => this.columns().map(c => c.width ?? 'minmax(0, 1fr)').join(' '));
    readonly wideAreas = computed(() => `"${this.columns().map(c => c.key).join(' ')}"`);

    private readonly compactPlaces = computed(() => {
        const keysIn = (place: ListCompactPlace) => this.columns().filter(c => c.compact === place).map(c => c.key);
        return { primary: keysIn('primary')[0] ?? '.', secondary: keysIn('secondary'), trailing: keysIn('trailing') };
    });

    // The primary cell spans the second line's columns; the last of those takes the space left, the others fit
    // their content. Trailing cells each take a column across both lines.
    readonly compactColumns = computed(() => {
        const { secondary, trailing } = this.compactPlaces();
        const lineColumns = [...secondary.slice(1).map(() => 'auto'), 'minmax(0, 1fr)'];
        return [...lineColumns, ...trailing.map(() => 'auto')].join(' ');
    });
    readonly compactAreas = computed(() => {
        const { primary, secondary, trailing } = this.compactPlaces();
        const first = [...(secondary.length > 0 ? secondary : ['.']).map(() => primary), ...trailing];
        if (secondary.length === 0) {
            return `"${first.join(' ')}"`;
        }
        return `"${first.join(' ')}" "${[...secondary, ...trailing].join(' ')}"`;
    });

    /** Sorts by a column: the column's first direction when it's newly chosen, or the other way when it's current. */
    sortBy(column: ListColumn) {
        const current = this.sort();
        const direction: ListSortDirection = current?.key === column.key
            ? (current.direction === 'asc' ? 'desc' : 'asc')
            : column.sort ?? 'asc';
        this.sortChange.emit({ key: column.key, direction });
    }

    /** The arrow for a column: the current direction when it's the sort, otherwise the direction it would start in. */
    sortArrow(column: ListColumn): string {
        const sort = this.sort();
        const direction = sort?.key === column.key ? sort.direction : column.sort;
        return direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
    }

    sortLabel(column: ListColumn): string {
        const sort = this.sort();
        if (sort?.key !== column.key) {
            return `Sort by ${column.label}`;
        }
        return `Sorted by ${column.label}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
    }
}

export const ListModule = [ListComponent, ListRowDirective, ListSubheaderDirective, ListCellDirective] as const;
