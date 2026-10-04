import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, delay } from 'rxjs';
import { DemoDataService } from './demo-data.service';

export const demoInterceptor: HttpInterceptorFn = req => {
    const demoData = inject(DemoDataService);

    // Simulate network delay
    const simulateDelay = 300;

    // Like the server, answer a signed-out visitor with no user rather than an error, which would show a snackbar.
    if (req.url.includes('auth/me')) {
        return of(new HttpResponse({ status: 200, body: demoData.getMe() })).pipe(delay(simulateDelay));
    }

    // Check before 'auth/register', which is a prefix of this URL.
    if (req.url.includes('auth/registration')) {
        return of(new HttpResponse({ status: 200, body: { isOpen: true } })).pipe(delay(simulateDelay));
    }

    if (req.url.includes('auth/login') || req.url.includes('auth/register')) {
        const user = demoData.login();
        return of(new HttpResponse({ status: 200, body: user })).pipe(delay(simulateDelay));
    }

    if (req.url.includes('auth/logout')) {
        demoData.logout();
        return of(new HttpResponse({ status: 200, body: {} })).pipe(delay(simulateDelay));
    }

    // Default mock response for other endpoints (can be expanded later)
    return of(new HttpResponse({ status: 200, body: [] })).pipe(delay(simulateDelay));
};
