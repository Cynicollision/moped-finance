import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Single-user app: the Register screen is only reachable until the first user exists (AUTH-2.7).
export const registrationGuard: CanActivateFn = async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (await authService.isRegistrationOpen()) {
        return true;
    }

    return router.createUrlTree(['/login']);
};
