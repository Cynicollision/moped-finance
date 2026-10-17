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
            register: vi.fn().mockResolvedValue(undefined)
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
        expect(mockAuthService.register).toHaveBeenCalledWith(
            { username: 'testuser', name: 'Test User', password: 'password1234', defaultCategories: true },
            undefined
        );
    });

    function fillIn(fields: { username?: string; displayName?: string } = {}) {
        component.username.set(fields.username ?? 'testuser');
        component.displayName.set(fields.displayName ?? 'Test User');
        component.password.set('password1234');
        component.confirmPassword.set('password1234');
    }

    function radioLabels(): string[] {
        return Array.from(fixture.nativeElement.querySelectorAll('mat-radio-button') as NodeListOf<HTMLElement>).map(
            radio => {
                const label = radio.cloneNode(true) as HTMLElement;
                label.querySelector('.option-hint')?.remove();
                return label.textContent!.trim();
            }
        );
    }

    it('AUTH-2.9 CAT-6.1 should offer default categories, selected, or starting empty', () => {
        const checked = fixture.nativeElement.querySelector('mat-radio-button.mat-mdc-radio-checked');

        expect(radioLabels()).toEqual(['Start with default categories', 'Start empty']);
        expect(checked.textContent).toContain('Start with default categories');
    });

    it('AUTH-2.9 should register without the default categories once Start empty is chosen', async () => {
        fillIn();
        const startEmpty = fixture.nativeElement.querySelectorAll('mat-radio-button input')[1] as HTMLInputElement;
        startEmpty.click();
        await fixture.whenStable();

        await component.onRegister();

        expect(component.defaultCategories()).toBe(false);
        expect(mockAuthService.register).toHaveBeenCalledWith(
            expect.objectContaining({ defaultCategories: false }),
            undefined
        );
    });

    it.each([
        [' testuser', "Username can't start or end with a space"],
        ['testuser ', "Username can't start or end with a space"],
        ['u'.repeat(51), "Username can't be longer than 50 characters"]
    ])('AUTH-2.10 should flag the username %j and not register', async (username, problem) => {
        fillIn({ username });
        await fixture.whenStable();

        await component.onRegister();

        expect(component.usernameProblem()).toBe(problem);
        expect(registerButton().disabled).toBe(true);
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it.each([
        ['   ', 'Display name is required'],
        ['N'.repeat(101), "Display name can't be longer than 100 characters"]
    ])('AUTH-2.10 should flag the display name %j and not register', async (displayName, problem) => {
        fillIn({ displayName });
        await fixture.whenStable();

        await component.onRegister();

        expect(component.displayNameProblem()).toBe(problem);
        expect(registerButton().disabled).toBe(true);
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('AUTH-2.10 should show the username problem under the field once it has been left', async () => {
        const input = fixture.nativeElement.querySelector('input[name="username"]') as HTMLInputElement;
        input.value = ' testuser';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('blur'));
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain(
            "Username can't start or end with a space"
        );
    });

    it('AUTH-2.10 should stop the username at 50 characters and the display name at 100', () => {
        const element = fixture.nativeElement as HTMLElement;

        expect(element.querySelector('input[name="username"]')!.getAttribute('maxlength')).toBe('50');
        expect(element.querySelector('input[name="displayName"]')!.getAttribute('maxlength')).toBe('100');
    });

    it('AUTH-2.11 AUTH-9.4 should list the password rules, marked as the user types, and register only once they are met', async () => {
        component.username.set('tester');
        component.displayName.set('Test User');
        component.password.set('Tester');
        component.confirmPassword.set('Tester');
        await fixture.whenStable();

        const rules = () =>
            Array.from(fixture.nativeElement.querySelectorAll('app-password-rules li') as NodeListOf<HTMLElement>).map(
                li => [li.querySelector('mat-icon + span')!.textContent, li.classList.contains('met')]
            );
        expect(rules()).toEqual([
            ['At least 8 characters', false],
            ['Not the same as the username', false]
        ]);
        expect(registerButton().disabled).toBe(true);
        await component.onRegister();
        expect(mockAuthService.register).not.toHaveBeenCalled();

        component.password.set('a longer password');
        component.confirmPassword.set('a longer password');
        await fixture.whenStable();

        expect(rules()).toEqual([
            ['At least 8 characters', true],
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
