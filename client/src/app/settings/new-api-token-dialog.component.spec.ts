import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { ApiTokenAccess } from '@shared/core/enum';
import { ApiTokenService } from './api-token.service';
import { NewApiTokenDialogComponent } from './new-api-token-dialog.component';

describe('NewApiTokenDialogComponent', () => {
    let component: NewApiTokenDialogComponent;
    let fixture: ComponentFixture<NewApiTokenDialogComponent>;
    let mockApiTokenService: any;
    let mockDialogRef: any;

    const createButton = () =>
        [...fixture.nativeElement.querySelectorAll('button')].find(
            (b: HTMLButtonElement) => b.textContent?.trim() === 'Create'
        ) as HTMLButtonElement;

    beforeEach(async () => {
        mockApiTokenService = {
            create: vi.fn().mockResolvedValue({ apiToken: { id: 'TOK1' }, token: 'mf_secret' })
        };
        mockDialogRef = { close: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [NewApiTokenDialogComponent],
            providers: [
                { provide: ApiTokenService, useValue: mockApiTokenService },
                { provide: MatDialogRef, useValue: mockDialogRef }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(NewApiTokenDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('AUTH-11.2 should default to read-only access and 90 days', () => {
        expect(component.form.getRawValue()).toEqual({ name: '', access: ApiTokenAccess.ReadOnly, expiresInDays: 90 });
    });

    it('AUTH-11.2 should keep Create disabled until a name is filled in', () => {
        expect(createButton().disabled).toBe(true);

        component.form.controls.name.setValue('   ');
        fixture.detectChanges();
        expect(createButton().disabled).toBe(true);

        component.form.controls.name.setValue('Sync job');
        fixture.detectChanges();
        expect(createButton().disabled).toBe(false);
    });

    it('AUTH-11.3 should show the new token once, with the warning, after creating it', async () => {
        component.form.setValue({ name: ' Sync job ', access: ApiTokenAccess.ReadWrite, expiresInDays: null });

        await component.create();
        fixture.detectChanges();

        expect(mockApiTokenService.create).toHaveBeenCalledWith({
            name: 'Sync job',
            access: ApiTokenAccess.ReadWrite,
            expiresInDays: null
        });
        expect(fixture.nativeElement.querySelector('input[readonly]').value).toBe('mf_secret');
        expect(fixture.nativeElement.textContent).toContain("Copy this token now. You won't be able to see it again.");
    });

    it('APP-2.7 should have unsaved changes once edited, until the token is created', async () => {
        expect(component.hasUnsavedChanges()).toBe(false);

        component.form.controls.name.setValue('Sync job');
        component.form.markAsDirty();
        expect(component.hasUnsavedChanges()).toBe(true);

        await component.create();
        expect(component.hasUnsavedChanges()).toBe(false);
    });
});
