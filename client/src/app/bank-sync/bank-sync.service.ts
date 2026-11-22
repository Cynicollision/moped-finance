import { Injectable, inject } from '@angular/core';
import { ConnectBankSyncRequest } from '@shared/finance/contracts';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { ApiService } from './../core/api.service';

const basePath = 'api/v1/bank-sync';

/**
 * The bank sync API (SYNC). `fetch*` methods load what Bank Sync shows and throw on failure (use them through
 * `viewResource`); the actions report failures themselves and resolve to undefined (false for `disconnect`).
 */
@Injectable({
    providedIn: 'root'
})
export class BankSyncService {
    private api = inject(ApiService);

    fetchStatus(): Promise<BankSyncStatus> {
        return this.api.load<BankSyncStatus>(basePath);
    }

    fetchAccounts(): Promise<BankAccount[]> {
        return this.api.load<BankAccount[]>(`${basePath}/accounts`);
    }

    fetchRuns(): Promise<SyncRun[]> {
        return this.api.load<SyncRun[]>(`${basePath}/runs`);
    }

    /** SYNC-1.1, and Connect again (SYNC-1.3). */
    connect(setupToken: string): Promise<BankSyncStatus | undefined> {
        const request: ConnectBankSyncRequest = { setupToken };
        return this.api.post<BankSyncStatus>(`${basePath}/connect`, request);
    }

    /** Sync now, and Try again while paused for payment (SYNC-3.3, SYNC-1.3). */
    sync(): Promise<SyncRun | undefined> {
        return this.api.post<SyncRun>(`${basePath}/sync`, {});
    }

    /** SYNC-1.4. */
    disconnect(): Promise<boolean> {
        return this.api.delete(basePath);
    }
}
