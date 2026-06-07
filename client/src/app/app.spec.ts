import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { DateProviderService } from './core/date-provider.service';
import { LoadingService } from './core/loading/loading.service';

describe('App', () => {
    let mockAuthService: any;
    let mockDateProvider: any;
    let mockLoadingService: any;
    let mockRouter: any;
    let mockBreakpointObserver: any;

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

        mockRouter = {
            events: of(),
            navigate: vi.fn()
        };

        mockBreakpointObserver = {
            observe: vi.fn().mockReturnValue(of({ matches: false }))
        };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: DateProviderService, useValue: mockDateProvider },
                { provide: LoadingService, useValue: mockLoadingService },
                { provide: Router, useValue: mockRouter },
                { provide: BreakpointObserver, useValue: mockBreakpointObserver },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParams: {} }
                    }
                }
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
