import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DateProviderService } from './../date-provider.service';
import { demoInterceptor } from './demo.interceptor';

describe('demoInterceptor', () => {
    const STORAGE_KEY = 'moped_finance_demo_data';

    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    function setup() {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([demoInterceptor])),
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 4, 17) } }
            ]
        });
        const http = TestBed.inject(HttpClient);
        return {
            get: (url: string) => respond(http.get(url)),
            post: (url: string) => respond(http.post(url, {}))
        };
    }

    async function respond<T>(request: ReturnType<HttpClient['get']>): Promise<T> {
        const response = firstValueFrom(request);
        await vi.runAllTimersAsync();
        return response as Promise<T>;
    }

    it("APP-4.2 should answer a signed-out visitor's session check with no user, not an error", async () => {
        const { get } = setup();

        expect(await get('/auth/me')).toBeNull();
    });

    it('APP-4.2 should sign in any Login or Register as the Demo User, and remember it in browser storage', async () => {
        const { get, post } = setup();

        const user = await post('/auth/login');
        expect(user).toMatchObject({ username: 'demo', displayName: 'Demo User' });
        expect(await get('/auth/me')).toEqual(user);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ isLoggedIn: true });

        expect(await post('/auth/register')).toEqual(user);
    });

    it('APP-4.2 should still be signed in after a reload, until signing out', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ isLoggedIn: true }));
        const { get, post } = setup();

        expect(await get('/auth/me')).toMatchObject({ displayName: 'Demo User' });

        await post('/auth/logout');
        expect(await get('/auth/me')).toBeNull();
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ isLoggedIn: false });
    });

    it('APP-4.2 should keep registration open, though auth/register is a prefix of its URL', async () => {
        const { get } = setup();

        expect(await get('/auth/registration')).toEqual({ isOpen: true });
        expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ isLoggedIn: false }));
    });

    it('APP-4.3 should answer every finance request with an empty list for now', async () => {
        const { get } = setup();

        expect(await get('/api/v1/accounts')).toEqual([]);
        expect(await get('/api/v1/transactions?limit=10')).toEqual([]);
    });
});
