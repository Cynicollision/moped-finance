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
        component.username = 'testuser';
        component.displayName = 'Test User';
        component.password = 'password123';
        component.confirmPassword = 'password456';

        await component.onRegister();

        expect(component.errorMessage).toBe('Passwords do not match.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should show error if fields are missing', async () => {
        component.username = '';
        component.displayName = 'Test User';
        component.password = 'password123';
        component.confirmPassword = 'password123';

        await component.onRegister();

        expect(component.errorMessage).toBe('All fields are required.');
        expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should call AuthService.register if validations pass', async () => {
        component.username = 'testuser';
        component.displayName = 'Test User';
        component.password = 'password123';
        component.confirmPassword = 'password123';

        await component.onRegister();

        expect(component.errorMessage).toBe('');
        expect(mockAuthService.register).toHaveBeenCalledWith('testuser', 'Test User', 'password123', undefined);
    });
});
