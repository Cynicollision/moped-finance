import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Shown in place of content that failed to load, with Retry (APP-2.9). */
@Component({
    selector: 'app-load-error',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './load-error.component.html',
    styleUrl: './load-error.component.scss',
    host: {
        role: 'alert'
    }
})
export class LoadErrorComponent {
    /** What failed, from `ViewResource.error()`. */
    readonly message = input.required<string>();
    readonly retry = output<void>();
}
