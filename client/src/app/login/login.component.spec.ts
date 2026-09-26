import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from './../core/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
    let component: LoginComponent;
    let fixture: ComponentFixture<LoginComponent>;
    let mockAuthService: any;
    let mockActivatedRoute: any;

    beforeEach(async () => {
        mockAuthService = {
            currentUser: signal(null),
            login: vi.fn().mockResolvedValue(undefined),
            isRegistrationOpen: vi.fn().mockResolvedValue(false)
        };

        mockActivatedRoute = {
            snapshot: {
                queryParams: { returnUrl: '/summary' }
            }
        };

        await TestBed.configureTestingModule({
            imports: [LoginComponent],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: ActivatedRoute, useValue: mockActivatedRoute }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should call AuthService.login with credentials and returnUrl on submit', async () => {
        component.username = 'stn';
        component.password = 'password';

        await component.onLogin();

        expect(mockAuthService.login).toHaveBeenCalledWith('stn', 'password', '/summary');
    });

    it('should not call AuthService.login if username is empty', async () => {
        component.username = '';
        component.password = 'password';

        await component.onLogin();

        expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('AUTH-2.7 should hide the register link when registration is closed', async () => {
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.register-prompt')).toBeNull();
    });

    it('AUTH-2.7 should show the register link when registration is open', async () => {
        mockAuthService.isRegistrationOpen.mockResolvedValue(true);
        await component.ngOnInit();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.register-prompt')).not.toBeNull();
    });
});
