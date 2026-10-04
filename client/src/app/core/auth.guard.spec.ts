import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { User } from '@shared/core/types/user';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
    function runGuard(user: User | null, url: string) {
        TestBed.configureTestingModule({
            providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser: signal(user) } }]
        });
        return TestBed.runInInjectionContext(() =>
            authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)
        );
    }

    it('AUTH-3.3 should let a signed-in user through', () => {
        expect(runGuard({ id: 'u1', username: 'owner', displayName: 'Owner' } as User, '/accounts/a1')).toBe(true);
    });

    it('AUTH-3.3 should send a signed-out visitor to Login, keeping the page they asked for', () => {
        const result = runGuard(null, '/accounts/a1?timeframe=PastYear');

        expect(result).toBeInstanceOf(UrlTree);
        expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
            '/login?returnUrl=%2Faccounts%2Fa1%3Ftimeframe%3DPastYear'
        );
    });
});
