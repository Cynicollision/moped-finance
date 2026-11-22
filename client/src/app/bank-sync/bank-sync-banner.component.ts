import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BankSyncWording } from '@shared/finance/contracts';
import { BankSyncAlertKind } from '@shared/finance/enum';
import { BankSyncAlert } from '@shared/finance/types';

/**
 * SYNC-5.1's banner: "Bank sync needs attention", with a line for each of the server's alerts, most serious first.
 * Shows nothing without alerts. On the Dashboard it links to Bank Sync; on Bank Sync itself it doesn't.
 */
@Component({
    selector: 'app-bank-sync-banner',
    imports: [DatePipe, MatButtonModule, MatIconModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bank-sync-banner.component.html',
    styleUrl: './bank-sync-banner.component.scss'
})
export class BankSyncBannerComponent {
    readonly alerts = input.required<BankSyncAlert[]>();
    /** Offers Open Bank Sync. */
    readonly showLink = input(false);

    readonly BankSyncAlertKind = BankSyncAlertKind;
    readonly wording = BankSyncWording;
    readonly newBankAccounts = newBankAccountsText;
}

/** SYNC-5.1's "2 new bank accounts found". */
export function newBankAccountsText(count: number): string {
    return `${count} new ${count === 1 ? 'bank account' : 'bank accounts'} found`;
}
