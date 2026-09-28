import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A grey placeholder the shape of content that's still loading (APP-2.1). Screens compose these where their
 * content will go, so nothing shows a zero or an empty state before the data arrives.
 */
@Component({
    selector: 'app-skeleton',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './skeleton.component.html',
    styleUrl: './skeleton.component.scss',
    host: {
        'aria-hidden': 'true',
        '[style.width]': 'width()',
        '[style.height]': 'height()'
    }
})
export class SkeletonComponent {
    /** Any CSS width. Default: the full width. */
    readonly width = input('100%');
    /** Any CSS height. Default: one line of body text. */
    readonly height = input('1em');
}
