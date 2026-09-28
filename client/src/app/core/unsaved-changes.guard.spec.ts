import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ModalService } from './modal/modal.service';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
    function check(component: unknown, discard: boolean) {
        const modalService = { confirmDiscard: vi.fn().mockResolvedValue(discard) };
        TestBed.configureTestingModule({ providers: [{ provide: ModalService, useValue: modalService }] });
        const result = TestBed.runInInjectionContext(() =>
            unsavedChangesGuard(component, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot));
        return { result, modalService };
    }

    it('APP-2.7 should let the user leave a form without changes', () => {
        const { result, modalService } = check({ hasUnsavedChanges: () => false }, false);

        expect(result).toBe(true);
        expect(modalService.confirmDiscard).not.toHaveBeenCalled();
    });

    it('APP-2.7 should ask before leaving unsaved changes, and stay if the user keeps editing', async () => {
        const { result, modalService } = check({ hasUnsavedChanges: () => true }, false);

        expect(await result).toBe(false);
        expect(modalService.confirmDiscard).toHaveBeenCalled();
    });

    it('APP-2.7 should leave once the user discards the changes', async () => {
        const { result } = check({ hasUnsavedChanges: () => true }, true);

        expect(await result).toBe(true);
    });
});
