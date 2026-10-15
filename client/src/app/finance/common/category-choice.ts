import { ValidatorFn } from '@angular/forms';
import { Category } from '@shared/finance/types';

/**
 * The categories a category field offers, matching what's typed (TXN-2.1): those `offered` accepts, whose name contains
 * the text. Once a category is chosen the field shows its name, so it offers all of them again, plus the chosen one.
 */
export function categoryChoices(
    categories: Category[],
    value: string,
    offered: (category: Category) => boolean
): Category[] {
    if (categories.some(c => c.id === value)) {
        return categories.filter(c => offered(c) || c.id === value);
    }
    const text = value.toLowerCase();
    return categories.filter(c => offered(c) && c.name.toLowerCase().includes(text));
}

/**
 * A category field's value is a category's ID, or empty for Uncategorized. Text typed but not chosen from the list is
 * `unknownCategory`, so it isn't saved (and refused by the server). `categoryIds` is read each time, since the
 * categories load after the form is made.
 */
export function chosenCategoryValidator(categoryIds: () => ReadonlyMap<string, unknown>): ValidatorFn {
    return control => (!control.value || categoryIds().has(control.value) ? null : { unknownCategory: true });
}
