import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { CategoryType } from '@shared/finance/enum';
import { DatabaseClient, EntityFactory } from '@server/data';
import { TestDatabaseUtil } from '@server/utility/testing';
import { CategoryData } from './category-data';
import { CategoryGroupData } from './category-groups';
import { DefaultCategories } from './default-categories';

describe('DefaultCategories', () => {
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let categoryData: CategoryData;
    let groupData: CategoryGroupData;
    let defaults: DefaultCategories;

    async function save(): Promise<void> {
        const step = await defaults.prepare();
        await dbClient.drizzle.transaction(step);
    }

    beforeAll(async () => {
        ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
        categoryData = new CategoryData(dbClient);
        groupData = new CategoryGroupData(dbClient);
        defaults = new DefaultCategories(
            path.join(__dirname, '../../../default-data/categories.csv'),
            categoryData,
            groupData
        );
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);
    });

    it('CAT-6.2 should create the default groups, with their types, and every category in them', async () => {
        await save();

        const groups = await groupData.retrieveAll();
        const categories = await categoryData.retrieveAll();
        const typeOf = (name: string) => groups.find(g => g.name === name)?.type;
        const countIn = (name: string) => categories.filter(c => c.groupId === groups.find(g => g.name === name)?.id);

        expect(groups.map(g => g.name).sort()).toEqual(
            [
                'Bills & Utilities',
                'Financial',
                'Food',
                'Giving',
                'Health',
                'Housing',
                'Income',
                'Lifestyle',
                'Shopping',
                'Transfers',
                'Transportation'
            ].sort()
        );
        expect(typeOf('Income')).toBe(CategoryType.Income);
        expect(typeOf('Housing')).toBe(CategoryType.Expense);
        expect(typeOf('Transfers')).toBe(CategoryType.Transfer);
        expect(countIn('Transportation')).toHaveLength(6);
        expect(categories).toHaveLength(42);
        expect(categories.every(c => c.icon && c.isActive)).toBe(true);
    });

    it('CAT-6.2 should skip a category that already exists, as an import does (CAT-7.3)', async () => {
        const group = EntityFactory.createCategoryGroup({ name: 'Food', type: CategoryType.Expense });
        await groupData.insert(group);
        await categoryData.insert(
            EntityFactory.createCategory({ groupId: group.id, name: 'groceries', icon: '', isActive: true })
        );

        await save();

        const categories = await categoryData.retrieveAll();
        expect(categories).toHaveLength(42);
        expect(categories.filter(c => c.name.toLowerCase() === 'groceries')).toHaveLength(1);
        expect((await groupData.retrieveAll()).filter(g => g.name === 'Food')).toHaveLength(1);
    });
});
