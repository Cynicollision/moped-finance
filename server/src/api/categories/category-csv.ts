import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { CsvColumn, CsvFile, CsvValue } from '@server/csv';
import { FinanceEntityFactory } from '@server/data';
import { EmojiUtil } from '@server/utility';

/** One category as the file shows it: with its group's name and type rather than the group's ID. */
export interface CategoryExport {
    type: CategoryType;
    groupName: string;
    name: string;
    icon: string;
    necessity: CategoryNecessity | null;
    isActive: boolean;
}

// Types in the order the Categories screen shows them (CAT-1.3), and as they're written: Income, Expense, Transfer.
const typeOrder = [CategoryType.Income, CategoryType.Expense, CategoryType.Transfer];
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
// "an Expense group", "a Transfer category".
const withArticle = (type: CategoryType) => `${type === CategoryType.Transfer ? 'a' : 'an'} ${label(type)}`;

const columns: CsvColumn<CategoryExport>[] = [
    { header: 'Type', value: c => label(c.type) },
    { header: 'Group', value: c => c.groupName },
    { header: 'Name', value: c => c.name },
    { header: 'Icon', value: c => c.icon },
    { header: 'Necessity', value: c => (c.necessity ? label(c.necessity) : '') },
    { header: 'IsActive', value: c => c.isActive }
];

const maxNameLength = 100;

export type CategoryCsvReadResult =
    | {
          success: true;
          /** Groups to create for the new categories, in the order the file first names them. */
          groups: CategoryGroup[];
          categories: Category[];
          /** Rows whose category already exists, by the file's spelling (CAT-7.3). */
          skippedNames: string[];
          failedRowMessages: string[];
      }
    | { success: false; message: string };

/** The category CSV format shared by export and import (CAT-7.1, CAT-7.2). */
export class CategoryCsv {
    /** Writes one row per category, ordered by type, group and name (CAT-7.1). */
    public static write(categories: CategoryExport[]): string {
        const sorted = [...categories].sort(
            (a, b) =>
                typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) ||
                a.groupName.localeCompare(b.groupName, undefined, { sensitivity: 'base' }) ||
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        return CsvFile.write(columns, sorted);
    }

    /**
     * Reads an import file against the existing groups and categories. Every row is checked (CAT-7.5), including those
     * that will be skipped. A valid row whose name is new becomes a category, in its existing group or a new one made
     * from the row's type (CAT-7.4); one whose name exists is skipped.
     */
    public static read(
        file: Buffer | undefined,
        existingGroups: CategoryGroup[],
        existingCategories: Category[]
    ): CategoryCsvReadResult {
        const csv = CsvFile.read(
            file,
            columns.map(c => c.header)
        );
        if (!csv.success) {
            return csv;
        }

        const groupsByName = new Map(existingGroups.map(g => [g.name.toLowerCase(), g]));
        const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
        // The type each group not yet saved takes, from the first row that names it, so later rows must agree.
        const fileGroups = new Map<string, { name: string; type: CategoryType; rowNumber: number }>();
        const newGroups = new Map<string, CategoryGroup>();
        // The first row with each name, so a repeat is reported against it.
        const fileNames = new Map<string, number>();

        const categories: Category[] = [];
        const skippedNames: string[] = [];
        const failedRowMessages: string[] = [];

        for (const row of csv.rows) {
            const values = row.values;
            const errors: string[] = row.error ? [row.error] : [];

            const type = CategoryCsv.parseType(values['Type'], errors);
            const groupName = CategoryCsv.requireName('Group', values['Group'], errors);
            const name = CategoryCsv.requireName('Name', values['Name'], errors);

            if (name && Uncategorized.isName(name)) {
                errors.push('Uncategorized is reserved for transactions without a category.');
            }
            if (name) {
                const firstRow = fileNames.get(name.toLowerCase());
                if (firstRow) {
                    errors.push(`Name '${name}' is already in row ${firstRow}.`);
                } else {
                    fileNames.set(name.toLowerCase(), row.rowNumber);
                }
            }

            const icon = values['Icon'];
            if (icon && !EmojiUtil.isSingleEmoji(icon)) {
                errors.push(`Icon '${icon}' is not a single emoji.`);
            }

            const necessity = CategoryCsv.parseNecessity(values['Necessity'], type, errors);
            const isActive = CsvValue.boolean('IsActive', values['IsActive'], true);
            if (!isActive.success) {
                errors.push(isActive.message);
            }

            // A group keeps one type: an existing group's, or for a new group, the type of the first row naming it.
            if (type && groupName) {
                const key = groupName.toLowerCase();
                const existing = groupsByName.get(key);
                const inFile = fileGroups.get(key);
                if (existing && existing.type !== type) {
                    errors.push(`Group '${existing.name}' is ${withArticle(existing.type)} group, not ${label(type)}.`);
                } else if (!existing && inFile && inFile.type !== type) {
                    errors.push(
                        `Group '${inFile.name}' is ${withArticle(inFile.type)} group in row ${inFile.rowNumber}, not ${label(type)}.`
                    );
                } else if (!existing && !inFile) {
                    fileGroups.set(key, { name: groupName, type, rowNumber: row.rowNumber });
                }
            }

            if (errors.length > 0 || !type || !groupName || !name || necessity === undefined || !isActive.success) {
                failedRowMessages.push(`Row ${row.rowNumber}: ${errors.join(' ')}`);
                continue;
            }

            if (existingNames.has(name.toLowerCase())) {
                skippedNames.push(name);
                continue;
            }

            // Only rows that create a category create their group, so an import never leaves an empty group.
            const groupKey = groupName.toLowerCase();
            let group = groupsByName.get(groupKey) ?? newGroups.get(groupKey);
            if (!group) {
                group = FinanceEntityFactory.createCategoryGroup({ name: fileGroups.get(groupKey)!.name, type });
                newGroups.set(groupKey, group);
            }

            categories.push(
                FinanceEntityFactory.createCategory({
                    groupId: group.id,
                    name,
                    icon,
                    necessity,
                    isActive: isActive.value
                })
            );
        }

        return { success: true, groups: [...newGroups.values()], categories, skippedNames, failedRowMessages };
    }

    private static parseType(text: string, errors: string[]): CategoryType | null {
        if (!text) {
            errors.push('Type is required.');
            return null;
        }
        const type = typeOrder.find(t => t === text.toLowerCase());
        if (!type) {
            errors.push(`Type '${text}' must be Income, Expense or Transfer.`);
            return null;
        }
        return type;
    }

    private static requireName(field: string, text: string, errors: string[]): string {
        if (!text) {
            errors.push(`${field} is required.`);
            return '';
        }
        if (text.length > maxNameLength) {
            errors.push(`${field} is longer than ${maxNameLength} characters.`);
            return '';
        }
        return text;
    }

    /** Blank is no necessity (null); undefined means the value was refused. Only Expense rows can have one (CAT-3.4). */
    private static parseNecessity(
        text: string,
        type: CategoryType | null,
        errors: string[]
    ): CategoryNecessity | null | undefined {
        if (!text) {
            return null;
        }
        const necessity = Object.values(CategoryNecessity).find(n => n === text.toLowerCase());
        if (!necessity) {
            errors.push(`Necessity '${text}' must be Essential, Discretionary or blank.`);
            return undefined;
        }
        if (type && type !== CategoryType.Expense) {
            errors.push(`Necessity must be blank for ${withArticle(type)} category.`);
            return undefined;
        }
        return necessity;
    }
}
