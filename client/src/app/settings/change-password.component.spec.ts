import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './../core/auth.service';
import { NotificationService } from './../core/notification.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
    async function render(changePassword = vi.fn().mockResolvedValue(true)) {
        const authService = {
            currentUser: signal({ id: 'user-1', username: 'ada', displayName: 'Ada' }),
            changePassword
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ChangePasswordComponent],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: authService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(ChangePasswordComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const inputs = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="password"]'));
        const button = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;

        async function fill(current: string, newPassword: string, confirm: string) {
            [current, newPassword, confirm].forEach((value, i) => {
                inputs[i].value = value;
                inputs[i].dispatchEvent(new Event('input'));
            });
            await fixture.whenStable();
        }

        async function submit() {
            // jsdom can't submit a form from its button
            element.querySelector('form')!.dispatchEvent(new Event('submit'));
            await fixture.whenStable();
        }

        return { fixture, element, inputs, button, fill, submit, authService, notificationService };
    }

    it('AUTH-5.2 should ask for the current password and the new one twice', async () => {
        const { element, button } = await render();

        expect(Array.from(element.querySelectorAll('mat-label')).map(label => label.textContent)).toEqual([
            'Current Password',
            'New Password',
            'Confirm New Password'
        ]);
        expect(button.textContent!.trim()).toBe('Change Password');
    });

    it('AUTH-5.3 should say that changing the password signs out the other devices', async () => {
        const { element } = await render();

        expect(element.querySelector('.section-description')!.textContent).toBe(
            'Changing your password signs out your other devices.'
        );
    });

    it('AUTH-5.2 should keep Change Password disabled until all three are filled', async () => {
        const { button, fill } = await render();

        await fill('old password', 'a new password', '');
        expect(button.disabled).toBe(true);

        await fill('old password', 'a new password', 'a new password');
        expect(button.disabled).toBe(false);
    });

    it('AUTH-5.2 should say when the new passwords do not match, and not submit', async () => {
        const { element, button, fill, submit, authService } = await render();

        await fill('old password', 'a new password', 'another one');
        await submit();

        expect(element.querySelector('.error-message')!.textContent).toBe('Passwords do not match.');
        expect(button.disabled).toBe(true);
        expect(authService.changePassword).not.toHaveBeenCalled();
    });

    it('AUTH-5.3 AUTH-9.4 should list the rules for the new password and not submit one that breaks them', async () => {
        const { element, button, fill, submit, authService } = await render();

        await fill('old password', 'ADA', 'ADA');
        await submit();

        expect(Array.from(element.querySelectorAll('app-password-rules li')).map(li => li.className)).toEqual(['', '']);
        expect(button.disabled).toBe(true);
        expect(authService.changePassword).not.toHaveBeenCalled();
    });

    it('AUTH-5.3 should change the password, say so and clear the fields', async () => {
        const { fixture, inputs, fill, submit, authService, notificationService } = await render();

        await fill('old password', 'a new password', 'a new password');
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
        await submit();

        expect(authService.changePassword).toHaveBeenCalledWith('old password', 'a new password');
        expect(notificationService.success).toHaveBeenCalledWith('Password changed.');
        expect(inputs.map(input => input.value)).toEqual(['', '', '']);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('AUTH-5.1 should keep the fields when the server refuses the current password', async () => {
        const { inputs, fill, submit, notificationService } = await render(vi.fn().mockResolvedValue(false));

        await fill('wrong password', 'a new password', 'a new password');
        await submit();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(inputs.map(input => input.value)).toEqual(['wrong password', 'a new password', 'a new password']);
    });
});
