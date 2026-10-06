import { CategoryType } from './../enum';

export interface CategoryImportResult {
    /** Categories created, or that would be created on a dry run. */
    createdCount: number;
    /** Groups the import creates for its new categories, as first spelled in the file (CAT-7.4). */
    newGroups: { name: string; type: CategoryType }[];
    /** Names of rows skipped because a category with that name already exists (CAT-7.3). */
    skippedNames: string[];
    /** One message per invalid row, such as "Row 3: Type is required." */
    failedRowMessages: string[];
    resultMessage: string;
    /** True when no row has an error. Imports are all-or-nothing, so only a valid file is saved. */
    isValidToImport: boolean;
}
