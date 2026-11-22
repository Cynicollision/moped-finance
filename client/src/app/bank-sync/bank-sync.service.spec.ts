import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './../core/notification.service';
import { BankSyncService } from './bank-sync.service';

describe('BankSyncService', () => {
    function setup() {
        const notificationService = { error: vi.fn() };
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        return {
            bankSync: TestBed.inject(BankSyncService),
            http: TestBed.inject(HttpTestingController),
            notificationService
        };
    }

    it('SYNC-1.1 should load the status, bank accounts and runs from the bank sync API', async () => {
        const { bankSync, http } = setup();

        const status = bankSync.fetchStatus();
        http.expectOne({ method: 'GET', url: '/api/v1/bank-sync' }).flush({ connected: false });
        await expect(status).resolves.toEqual({ connected: false });

        const accounts = bankSync.fetchAccounts();
        http.expectOne({ method: 'GET', url: '/api/v1/bank-sync/accounts' }).flush([]);
        await expect(accounts).resolves.toEqual([]);

        const runs = bankSync.fetchRuns();
        http.expectOne({ method: 'GET', url: '/api/v1/bank-sync/runs' }).flush([]);
        await expect(runs).resolves.toEqual([]);
        http.verify();
    });

    it('SYNC-1.1 should post the setup token to connect', async () => {
        const { bankSync, http } = setup();

        const connected = bankSync.connect('fake');
        const request = http.expectOne({ method: 'POST', url: '/api/v1/bank-sync/connect' });
        expect(request.request.body).toEqual({ setupToken: 'fake' });
        request.flush({ connected: true });

        await expect(connected).resolves.toEqual({ connected: true });
    });

    it('SYNC-3.3 should report a refused sync and resolve to undefined', async () => {
        const { bankSync, http, notificationService } = setup();

        const run = bankSync.sync();
        http.expectOne({ method: 'POST', url: '/api/v1/bank-sync/sync' }).flush(
            { message: 'A sync is already running.' },
            { status: 409, statusText: 'Conflict' }
        );

        await expect(run).resolves.toBeUndefined();
        expect(notificationService.error).toHaveBeenCalledWith('A sync is already running.');
    });

    it('SYNC-1.4 should delete the connection to disconnect', async () => {
        const { bankSync, http } = setup();

        const disconnected = bankSync.disconnect();
        http.expectOne({ method: 'DELETE', url: '/api/v1/bank-sync' }).flush(null, {
            status: 204,
            statusText: 'No Content'
        });

        await expect(disconnected).resolves.toBe(true);
    });
});
