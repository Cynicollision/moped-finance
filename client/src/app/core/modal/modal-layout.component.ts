import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ModalCancelDirective } from './modal-cancel.directive';

/**
 * The frame of every dialog: a title with a close button, the content, and an action bar. Put the dialog's
 * buttons in an element marked `modal-actions` (right-aligned: Cancel, then the main action) and a Delete
 * button in one marked `modal-actions-start` (left-aligned). A form's submit button sits outside the
 * `<form>`, so give it `form="<the form's id>"`.
 */
@Component({
    selector: 'app-modal-layout',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule, MatIconModule, ModalCancelDirective],
    templateUrl: './modal-layout.component.html',
    styleUrl: './modal-layout.component.scss'
})
export class ModalLayoutComponent {
    /** Optional title to show in the header. You can also pass custom title markup via the [modal-title] slot. */
    readonly title = input<string>();

    /** Whether to show the standard X close button. Default: true */
    readonly showClose = input(true);
}
