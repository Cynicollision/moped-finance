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
                queryParams: { returnUrl: '/dashboard' }
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

    function loginButton(): HTMLButtonElement {
        return fixture.nativeElement.querySelector('button[type="submit"]');
    }

    it('AUTH-1.1 should show Username, Password and a Login button', () => {
        const element = fixture.nativeElement as HTMLElement;
        const labels = Array.from(element.querySelectorAll('mat-label')).map(label => label.textContent?.trim());

        expect(labels).toEqual(['Username', 'Password']);
        expect(loginButton().textContent?.trim()).toBe('Login');
    });

    it('AUTH-1.3 should call AuthService.login with credentials and returnUrl on submit', async () => {
        component.username.set('stn');
        component.password.set('password');

        await component.onLogin();

        expect(mockAuthService.login).toHaveBeenCalledWith('stn', 'password', '/dashboard');
    });

    it('AUTH-1.2 should keep Login disabled until both Username and Password are filled', async () => {
        const states: boolean[] = [];
        for (const [username, password] of [
            ['', 'password'],
            ['stn', ''],
            ['stn', 'password']
        ]) {
            component.username.set(username);
            component.password.set(password);
            await fixture.whenStable();
            states.push(loginButton().disabled);
        }

        expect(states).toEqual([true, true, false]);
    });

    it('AUTH-1.2 should not call AuthService.login if username is empty', async () => {
        component.username.set('');
        component.password.set('password');

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

    it('APP-3.1 should show the product name', () => {
        expect(fixture.nativeElement.querySelector('.brand-title').textContent).toBe('Moped Finance');
    });
});
