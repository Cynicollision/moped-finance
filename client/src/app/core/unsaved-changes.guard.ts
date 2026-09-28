import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ModalService } from './modal/modal.service';
import { hasUnsavedChanges } from './unsaved-changes';

/** For the routes of full-page forms: asks before navigating away from unsaved changes (APP-2.7). */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = component => {
    if (!hasUnsavedChanges(component)) {
        return true;
    }
    return inject(ModalService).confirmDiscard();
};
