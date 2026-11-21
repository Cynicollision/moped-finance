import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BankSyncStatus } from '@shared/finance/types';
import { BankSyncService } from './bank-sync.service';

/**
 * Pasting a SimpleFIN setup token to connect (SYNC-1.1) or connect again (SYNC-1.3). Emits the new status once the
 * server has claimed the token and run its first sync; a refused token keeps what was typed.
 */
@Component({
    selector: 'app-setup-token-form',
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './setup-token-form.component.html',
    styleUrl: './setup-token-form.component.scss'
})
export class SetupTokenFormComponent {
    private bankSyncService = inject(BankSyncService);

    readonly actionLabel = input('Connect');
    /** Offers Cancel, for Connect again, which opens the form in place. */
    readonly cancellable = input(false);
    readonly connected = output<BankSyncStatus>();
    readonly cancelled = output<void>();

    readonly connecting = signal(false);
    readonly form = new FormGroup({
        setupToken: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.pattern(/\S/)]
        })
    });

    async connect() {
        if (this.form.invalid || this.connecting()) {
            return;
        }
        this.connecting.set(true);
        const status = await this.bankSyncService.connect(this.form.controls.setupToken.value.trim());
        this.connecting.set(false);
        if (status) {
            this.form.reset();
            this.connected.emit(status);
        }
    }
}
