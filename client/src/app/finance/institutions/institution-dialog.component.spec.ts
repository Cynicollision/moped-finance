import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Institution } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { InstitutionDialogComponent, InstitutionDialogData } from './institution-dialog.component';

describe('InstitutionDialogComponent', () => {
    const firstBank = { id: 'inst-1', name: 'First Bank' } as Institution;

    async function render(data: InstitutionDialogData, confirmed = true) {
        const financeService = {
            createInstitution: vi.fn().mockResolvedValue({ id: 'inst-2', name: 'Credit Union' }),
            saveInstitution: vi.fn().mockResolvedValue(firstBank),
            deleteInstitution: vi.fn().mockResolvedValue(true)
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        const modalService = { confirm: vi.fn().mockResolvedValue(confirmed), requestClose: vi.fn() };
        TestBed.configureTestingModule({
            imports: [InstitutionDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: data },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: modalService }
            ]
        });

        const fixture = TestBed.createComponent(InstitutionDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        return { fixture, element, financeService, dialogRef, notificationService, modalService };
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement {
        return Array.from(element.querySelectorAll('button')).find(b => b.textContent!.trim() === label)!;
    }

    async function typeName(fixture: Awaited<ReturnType<typeof render>>['fixture'], name: string) {
        const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
        input.value = name;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
    }

    it('INST-1.4 should add an institution, say so, and close', async () => {
        const { fixture, element, financeService, dialogRef, notificationService } = await render({});

        expect(element.textContent).toContain('Add Institution');
        expect(button(element, 'Save').disabled).toBe(true);
        expect(button(element, 'Delete')).toBeUndefined();

        await typeName(fixture, ' Credit Union ');
        button(element, 'Save').click();
        await fixture.whenStable();

        expect(financeService.createInstitution).toHaveBeenCalledWith({ name: 'Credit Union' });
        expect(notificationService.success).toHaveBeenCalledWith('Institution added');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('INST-1.6 should rename an institution', async () => {
        const { fixture, element, financeService, notificationService } = await render({ institution: firstBank, accountCount: 0 });

        expect(element.textContent).toContain('Edit Institution');
        await typeName(fixture, 'First National');
        button(element, 'Save').click();
        await fixture.whenStable();

        expect(financeService.saveInstitution).toHaveBeenCalledWith({ ...firstBank, name: 'First National' });
        expect(notificationService.success).toHaveBeenCalledWith('Institution saved');
    });

    it('APP-2.7 should have unsaved changes once the name is edited', async () => {
        const { fixture } = await render({ institution: firstBank, accountCount: 0 });
        const dialog = fixture.componentInstance;

        expect(dialog.hasUnsavedChanges()).toBe(false);
        await typeName(fixture, 'First National');
        expect(dialog.hasUnsavedChanges()).toBe(true);
    });

    it('INST-1.8 should delete an institution with no accounts, after confirming', async () => {
        const { fixture, element, financeService, dialogRef, notificationService, modalService } = await render({ institution: firstBank, accountCount: 0 });

        button(element, 'Delete').click();
        await fixture.whenStable();

        expect(modalService.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Institution', isWarn: true }));
        expect(financeService.deleteInstitution).toHaveBeenCalledWith('inst-1');
        expect(notificationService.success).toHaveBeenCalledWith('Institution deleted');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('INST-1.8 should not delete when the user cancels the confirmation', async () => {
        const { fixture, element, financeService, dialogRef } = await render({ institution: firstBank, accountCount: 0 }, false);

        button(element, 'Delete').click();
        await fixture.whenStable();

        expect(financeService.deleteInstitution).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('INST-1.9 should disable Delete, and say why, while the institution has accounts', async () => {
        const { element } = await render({ institution: firstBank, accountCount: 2 });

        expect(button(element, 'Delete').disabled).toBe(true);
        expect(element.querySelector('.delete-note')!.textContent!.trim()).toBe('To delete this institution, first delete its 2 accounts.');
    });
});
