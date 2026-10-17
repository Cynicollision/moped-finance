import { readFile } from 'fs/promises';
import { DbTransaction } from '@server/data';
import { CategoryCsv } from './category-csv';
import { ICategoryData, insertGroupsAndCategories } from './category-data';
import { ICategoryGroupData } from './category-groups';

/**
 * The groups and categories a new instance can start with (CAT-6.2). They're a CSV in the import format (CAT-7.1),
 * `server/default-data/categories.csv`, read with the import's own reader so the list and the format can't drift apart.
 */
export class DefaultCategories {
    constructor(
        private readonly file: string,
        private readonly categoryData: ICategoryData,
        private readonly groupData: ICategoryGroupData
    ) {}

    /**
     * Reads the file against the categories already saved, as an import does, and returns the step that saves the rest
     * inside the caller's transaction. A file the import would refuse is a bug, so it throws.
     */
    public async prepare(): Promise<(tx: DbTransaction) => Promise<void>> {
        const [file, groups, categories] = await Promise.all([
            readFile(this.file),
            this.groupData.retrieveAll(),
            this.categoryData.retrieveAll()
        ]);

        const result = CategoryCsv.read(file, groups, categories);
        if (!result.success) {
            throw new Error(`The default categories file can't be read: ${result.message}`);
        }
        if (result.failedRowMessages.length > 0) {
            throw new Error(`The default categories file has errors: ${result.failedRowMessages.join(' ')}`);
        }

        return tx => insertGroupsAndCategories(tx, result.categories, result.groups);
    }
}
