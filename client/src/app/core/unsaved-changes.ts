/**
 * A screen or dialog with a form the user can leave part-way through (APP-2.7). Leaving while it reports
 * unsaved changes asks "Discard changes?" first: `unsavedChangesGuard` for screens, `ModalService` for dialogs.
 */
export interface HasUnsavedChanges {
    hasUnsavedChanges(): boolean;
}

export function hasUnsavedChanges(component: unknown): boolean {
    const candidate = component as Partial<HasUnsavedChanges> | null;
    return typeof candidate?.hasUnsavedChanges === 'function' && candidate.hasUnsavedChanges();
}
