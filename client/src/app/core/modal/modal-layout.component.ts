import { Component, Input } from '@angular/core';
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
    @Input() showClose = true;

    /** Alignment of actions in the bottom bar. Default: 'end' */
    @Input() alignActions: 'start' | 'center' | 'end' = 'end';
}
