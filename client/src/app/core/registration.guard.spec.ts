import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { registrationGuard } from './registration.guard';

describe('registrationGuard', () => {
    let mockAuthService: any;

    const runGuard = () =>
        TestBed.runInInjectionContext(() => registrationGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

    beforeEach(() => {
        mockAuthService = {
            isRegistrationOpen: vi.fn()
        };

        TestBed.configureTestingModule({
            providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }]
        });
    });

    it('AUTH-2.7 should allow the Register screen while registration is open', async () => {
        mockAuthService.isRegistrationOpen.mockResolvedValue(true);

        expect(await runGuard()).toBe(true);
    });

    it('AUTH-2.7 should redirect to Login once registration is closed', async () => {
        mockAuthService.isRegistrationOpen.mockResolvedValue(false);

        const result = await runGuard();

        expect(result).toBeInstanceOf(UrlTree);
        expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
    });
});
