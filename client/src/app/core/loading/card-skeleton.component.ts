import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/** A placeholder card: a heading and `rows` lines of name and amount, for lists that are still loading (APP-2.1). */
@Component({
    selector: 'app-card-skeleton',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SkeletonComponent],
    templateUrl: './card-skeleton.component.html',
    styleUrl: './card-skeleton.component.scss',
    host: {
        'aria-busy': 'true',
        'aria-label': 'Loading'
    }
})
export class CardSkeletonComponent {
    readonly rows = input(3);

    // Vary the widths a little so the placeholder reads as text rather than a grid.
    readonly rowWidths = computed(() => Array.from({ length: this.rows() }, (_, i) => `${[55, 40, 65, 48][i % 4]}%`));
}
