import { Component, Input, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-modal-layout',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, MatIconModule],
    templateUrl: './modal-layout.component.html',
    styleUrl: './modal-layout.component.scss'
})
export class ModalLayoutComponent {
    /** Optional title to show in the header. You can also pass custom title markup via the [modal-title] slot. */
    @Input() title?: string;

    /** Whether to show the standard X close button. Default: true */
    readonly showClose = input(true);

    /** Alignment of actions in the bottom bar. Default: 'end' */
    readonly alignActions = input<'start' | 'center' | 'end'>('end');
}
