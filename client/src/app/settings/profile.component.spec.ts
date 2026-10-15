import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@shared/core/types';
import { AuthService } from './../core/auth.service';
import { NotificationService } from './../core/notification.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
    const user: User = {
        id: 'user-1',
        username: 'ada',
        displayName: 'Ada Lovelace',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };

    async function render(updateProfile = vi.fn().mockResolvedValue({ ...user, displayName: 'Ada King' })) {
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ProfileComponent],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { currentUser: signal(user), updateProfile } },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(ProfileComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const inputs = element.querySelectorAll<HTMLInputElement>('input');
        const saveButton = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        return { fixture, element, username: inputs[0], displayName: inputs[1], saveButton, notificationService };
    }

    // jsdom can't submit a form from its button
    function submit(element: HTMLElement) {
        element.querySelector('form')!.dispatchEvent(new Event('submit'));
    }

    function type(input: HTMLInputElement, value: string) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
    }

    it('SET-2.1 should show the username read-only and the display name to edit', async () => {
        const { username, displayName, saveButton } = await render();

        expect(username.value).toBe('ada');
        expect(username.readOnly).toBe(true);
        expect(displayName.value).toBe('Ada Lovelace');
        expect(saveButton.disabled).toBe(true);
    });

    it('SET-2.1 should save the trimmed display name and say so', async () => {
        const updateProfile = vi.fn().mockResolvedValue({ ...user, displayName: 'Ada King' });
        const { fixture, element, displayName, notificationService } = await render(updateProfile);

        type(displayName, '  Ada King  ');
        await fixture.whenStable();
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
        submit(element);
        await fixture.whenStable();

        expect(updateProfile).toHaveBeenCalledWith('Ada King');
        expect(notificationService.success).toHaveBeenCalledWith('Profile saved');
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('SET-2.1 should not save a display name of only spaces', async () => {
        const { fixture, displayName, saveButton } = await render();

        type(displayName, '   ');
        await fixture.whenStable();

        expect(saveButton.disabled).toBe(true);
    });

    it('APP-2.7 should keep unsaved changes when the server refuses them', async () => {
        const { fixture, element, displayName, notificationService } = await render(
            vi.fn().mockResolvedValue(undefined)
        );

        type(displayName, 'Ada King');
        await fixture.whenStable();
        submit(element);
        await fixture.whenStable();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });
});
