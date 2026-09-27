import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { DateProviderService } from './core/date-provider.service';
import { LoadingService } from './core/loading/loading.service';

describe('App', () => {
    let mockAuthService: any;
    let mockDateProvider: any;
    let mockLoadingService: any;

    beforeEach(async () => {
        mockAuthService = {
            currentUser: signal({ id: '1', displayName: 'Test User', username: 'test' }),
            logout: vi.fn()
        };

        mockDateProvider = {
            now: vi.fn().mockReturnValue(new Date('2026-01-01'))
        };

        mockLoadingService = {
            isLoading: signal(false)
        };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: DateProviderService, useValue: mockDateProvider },
                { provide: LoadingService, useValue: mockLoadingService },
                provideRouter([])
            ]
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it('should render sidenav container', async () => {
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('mat-sidenav-container')).toBeTruthy();
    });
});
