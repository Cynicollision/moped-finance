import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from './../core/auth.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
    let component: RegisterComponent;
    let fixture: ComponentFixture<RegisterComponent>;
    let mockAuthService: any;
    let mockActivatedRoute: any;

    beforeEach(async () => {
        mockAuthService = {
            currentUser: signal(null),
            register: vi.fn().mockResolvedValue(undefined),
            fetchPasswordPolicy: vi.fn().mockResolvedValue({ minLength: 12 })
        };

        mockActivatedRoute = {
            snapshot: {
                queryParams: {}
            }
        };

        await TestBed.configureTestingModule({
            imports: [RegisterComponent],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: ActivatedRoute, useValue: mockActivatedRoute }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(RegisterComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    function registerButton(): HTMLButtonElement {
        return fixture.nativeElement.querySelector('button[type="submit"]');
    }

    it('AUTH-2.1 should show the four fields, a Register button and a link to Login', () => {
        const element = fixture.nativeElement as HTMLElement;
        const labels = Array.from(element.querySelectorAll('mat-label')).map(label => label.textContent?.trim());
        const link = element.querySelector<HTMLAnchorElement>('.login-prompt a')!;

        expect(labels).toEqual(['Username', 'Display Name', 'Password', 'Confirm Password']);
        expect(registerButton().textContent?.trim()).toBe('Register');
        expect(link.textContent).toBe('Login here');
        expect(link.getAttribute('href')).toBe('/login');
    });

    it('AUTH-2.2 should keep Register disabled until all four fields are filled', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password1234');
        await fixture.whenStable();
        const withThree = registerButton().disabled;

        component.confirmPassword.set('password1234');
        await fixture.whenStable();

        expect(withThree).toBe(true);
        expect(registerButton().disabled).toBe(false);
    });

    it('AUTH-2.3 should show error if passwords do not match', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password1234');
        component.confirmPassword.set('password4567');

        await component.onRegister();

        expect(component.errorMessage()).toBe('Passwords do not match.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('AUTH-2.3 should render the error message', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password1234');
        component.confirmPassword.set('password4567');

        await component.onRegister();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector('.error-message')?.textContent).toContain('Passwords do not match.');
    });

    it('AUTH-2.2 should show error if fields are missing', async () => {
        component.username.set('');
        component.displayName.set('Test User');
        component.password.set('password1234');
        component.confirmPassword.set('password1234');

        await component.onRegister();

        expect(component.errorMessage()).toBe('All fields are required.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('AUTH-2.5 should call AuthService.register if validations pass', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password1234');
        component.confirmPassword.set('password1234');

        await component.onRegister();

        expect(component.errorMessage()).toBe('');
        expect(mockAuthService.register).toHaveBeenCalledWith('testuser', 'Test User', 'password1234', undefined);
    });

    it('AUTH-2.11 AUTH-9.4 should list the password rules, marked as the user types, and register only once they are met', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('testuser');
        component.confirmPassword.set('testuser');
        await fixture.whenStable();

        const rules = () =>
            Array.from(fixture.nativeElement.querySelectorAll('app-password-rules li') as NodeListOf<HTMLElement>).map(
                li => [li.querySelector('mat-icon + span')!.textContent, li.classList.contains('met')]
            );
        expect(rules()).toEqual([
            ['At least 12 characters', false],
            ['Not the same as the username', false]
        ]);
        expect(registerButton().disabled).toBe(true);
        await component.onRegister();
        expect(mockAuthService.register).not.toHaveBeenCalled();

        component.password.set('a longer password');
        component.confirmPassword.set('a longer password');
        await fixture.whenStable();

        expect(rules()).toEqual([
            ['At least 12 characters', true],
            ['Not the same as the username', true]
        ]);
        expect(registerButton().disabled).toBe(false);
    });

    it('APP-3.1 should show the product name', () => {
        expect(fixture.nativeElement.querySelector('.brand-title').textContent).toBe('Moped Finance');
    });

    it("AUTH-2.8 should explain, before the form, that this is the instance's only account and registration closes", () => {
        const element = fixture.nativeElement as HTMLElement;
        const explanation = element.querySelector('.one-account')!;

        expect(explanation.textContent).toMatch(/only account/);
        expect(explanation.textContent).toMatch(/own all of the instance's data/);
        expect(explanation.textContent).toMatch(/registration closes/);
        expect(
            explanation.compareDocumentPosition(element.querySelector('form')!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
});
