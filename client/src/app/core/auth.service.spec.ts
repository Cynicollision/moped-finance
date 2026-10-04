import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { User } from '@shared/core/types/user';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('AuthService', () => {
    const user = { id: 'u1', username: 'owner', displayName: 'Owner' } as User;

    function setup() {
        const notificationService = { error: vi.fn() };
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        return {
            auth: TestBed.inject(AuthService),
            http: TestBed.inject(HttpTestingController),
            navigate,
            notificationService
        };
    }

    it('should take the signed-in user from the session', async () => {
        const { auth, http } = setup();

        const check = auth.checkSession();
        http.expectOne('/auth/me').flush(user);
        await check;

        expect(auth.currentUser()).toEqual(user);
    });

    it('should have no user when the session has none, without reporting an error', async () => {
        const { auth, http, notificationService } = setup();

        const check = auth.checkSession();
        http.expectOne('/auth/me').flush(null);
        await check;

        expect(auth.currentUser()).toBeNull();
        expect(notificationService.error).not.toHaveBeenCalled();
    });

    it('AUTH-1.3 should sign in and go to the page first asked for, or the Dashboard', async () => {
        const { auth, http, navigate } = setup();

        const withReturn = auth.login('owner', 'secret', '/accounts/a1');
        const request = http.expectOne('/auth/login');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ username: 'owner', password: 'secret' });
        request.flush(user);
        await withReturn;

        const withoutReturn = auth.login('owner', 'secret');
        http.expectOne('/auth/login').flush(user);
        await withoutReturn;

        expect(auth.currentUser()).toEqual(user);
        expect(navigate.mock.calls).toEqual([[['/accounts/a1']], [['/']]]);
    });

    it('AUTH-1.4 should stay signed out on the Login screen when the server refuses', async () => {
        const { auth, http, navigate, notificationService } = setup();

        const login = auth.login('owner', 'wrong');
        http.expectOne('/auth/login').flush(
            { message: 'Invalid username or password.' },
            { status: 401, statusText: 'Unauthorized' }
        );
        await login;

        expect(auth.currentUser()).toBeNull();
        expect(navigate).not.toHaveBeenCalled();
        expect(notificationService.error).toHaveBeenCalledWith('Invalid username or password.');
    });

    it('AUTH-2.5 should sign in straight after registering, sending the display name as name', async () => {
        const { auth, http, navigate } = setup();

        const register = auth.register('owner', 'Owner', 'secret', '/budget');
        const request = http.expectOne('/auth/register');
        expect(request.request.body).toEqual({ username: 'owner', name: 'Owner', password: 'secret' });
        request.flush(user);
        await register;

        expect(auth.currentUser()).toEqual(user);
        expect(navigate).toHaveBeenCalledWith(['/budget']);
    });

    it("AUTH-2.7 should treat registration as closed when its status can't be read", async () => {
        const { auth, http } = setup();

        const open = auth.isRegistrationOpen();
        http.expectOne('/auth/registration').flush({ isOpen: true });
        const failed = auth.isRegistrationOpen();
        http.expectOne('/auth/registration').error(new ProgressEvent('error'));

        expect(await open).toBe(true);
        expect(await failed).toBe(false);
    });

    it('AUTH-4.1 should end the session, forget the user and go to Login on sign out', async () => {
        const { auth, http, navigate } = setup();
        auth.currentUser.set(user);

        const logout = auth.logout();
        const request = http.expectOne('/auth/logout');
        expect(request.request.method).toBe('POST');
        request.flush({});
        await logout;

        expect(auth.currentUser()).toBeNull();
        expect(navigate).toHaveBeenCalledWith(['/login']);
    });
});
