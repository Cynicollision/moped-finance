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
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should show error if passwords do not match', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password123');
        component.confirmPassword.set('password456');

        await component.onRegister();

        expect(component.errorMessage()).toBe('Passwords do not match.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should render the error message', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password123');
        component.confirmPassword.set('password456');

        await component.onRegister();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector('.error-message')?.textContent).toContain('Passwords do not match.');
    });

    it('should show error if fields are missing', async () => {
        component.username.set('');
        component.displayName.set('Test User');
        component.password.set('password123');
        component.confirmPassword.set('password123');

        await component.onRegister();

        expect(component.errorMessage()).toBe('All fields are required.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should call AuthService.register if validations pass', async () => {
        component.username.set('testuser');
        component.displayName.set('Test User');
        component.password.set('password123');
        component.confirmPassword.set('password123');

        await component.onRegister();

        expect(component.errorMessage()).toBe('');
        expect(mockAuthService.register).toHaveBeenCalledWith('testuser', 'Test User', 'password123', undefined);
    });
});
