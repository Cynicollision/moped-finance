import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';

describe('ApiService', () => {
    function setup() {
        const notificationService = { error: vi.fn() };
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        return { api: TestBed.inject(ApiService), http: TestBed.inject(HttpTestingController), notificationService };
    }

    it('APP-2.9 should throw a failed load to the screen, without a snackbar', async () => {
        const { api, http, notificationService } = setup();

        const load = api.load('api/accounts');
        http.expectOne('/api/accounts').flush({ message: 'Nope' }, { status: 400, statusText: 'Bad Request' });

        await expect(load).rejects.toBeDefined();
        expect(notificationService.error).not.toHaveBeenCalled();
    });

    it("APP-2.2 should report a failed action in a snackbar with the server's message, resolving to undefined", async () => {
        const { api, http, notificationService } = setup();

        const save = api.post('api/institutions', { name: 'Dup' });
        http.expectOne('/api/institutions').flush(
            { message: 'An institution with that name already exists.' },
            { status: 400, statusText: 'Bad Request' }
        );

        expect(await save).toBeUndefined();
        expect(notificationService.error).toHaveBeenCalledWith('An institution with that name already exists.');
    });

    it("APP-2.2 should say so when the server can't be reached", async () => {
        const { api, http, notificationService } = setup();

        const remove = api.delete('api/accounts/a1');
        http.expectOne('/api/accounts/a1').error(new ProgressEvent('error'));

        expect(await remove).toBe(false);
        expect(notificationService.error).toHaveBeenCalledWith('Network or server error encountered.');
    });
});
