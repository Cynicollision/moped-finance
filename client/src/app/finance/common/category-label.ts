import { Category } from '@shared/finance/types';

/** A category as the app names it: its icon and name, or just its name when it has no icon (CAT-1.2). */
export function categoryLabel(category: Category): string {
    return category.icon ? `${category.icon} ${category.name}` : category.name;
}
