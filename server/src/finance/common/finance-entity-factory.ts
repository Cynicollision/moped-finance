import { NewEntity } from '@shared/core/types';
import { Account, BalanceHistory, BudgetStream, Category, CategoryGroup, Institution, Transaction } from '@shared/finance/types';
import { DateTimeUtil, EntityIdUtil } from '@server-core/utility';
export enum FinanceEntityIdPrefix {
    Account = '10',
    BalanceHistory = '11',
    Transaction = '12',
    Institution = '13',
    Category = '14',
    CategoryGroup = '15',
    BudgetStream = '16'
}

export class FinanceEntityFactory {

    // TODO: only used in seed script. Try to remove.
    public static generateId(prefix: string): string {
        return EntityIdUtil.generate(prefix);
    }

    private static createEntity<T extends { id: string, createdAt: Date, updatedAt: Date }>(prefix: string, newEntity: NewEntity<T>): T {
        return {
            ...newEntity,
            id: newEntity.id || FinanceEntityFactory.generateId(prefix),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        } as unknown as T;
    }

    public static createAccount(userId: string, account: NewEntity<Account>): Account {
        const entity = FinanceEntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, account);
        entity.userId = userId;
        return entity;
    }

    public static createBalanceHistory(userId: string, history: NewEntity<BalanceHistory>): BalanceHistory {
        const entity = FinanceEntityFactory.createEntity<BalanceHistory>(FinanceEntityIdPrefix.BalanceHistory, history);
        entity.userId = userId;
        return entity;
    }

    public static createTransaction(userId: string, transaction: NewEntity<Transaction>): Transaction {
        const entity = FinanceEntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, transaction);
        entity.userId = userId;
        return entity;
    }

    public static createInstitution(userId: string, institution: NewEntity<Institution>): Institution {
        const entity = FinanceEntityFactory.createEntity<Institution>(FinanceEntityIdPrefix.Institution, institution);
        entity.userId = userId;
        return entity;
    }

    public static createCategory(userId: string, category: NewEntity<Category>): Category {
        const entity = FinanceEntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, category);
        entity.userId = userId;
        return entity;
    }

    public static createCategoryGroup(userId: string, group: NewEntity<CategoryGroup>): CategoryGroup {
        const entity = FinanceEntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
        entity.userId = userId;
        return entity;
    }

    public static createBudgetStream(userId: string, stream: NewEntity<BudgetStream>): BudgetStream {
        const entity = FinanceEntityFactory.createEntity<BudgetStream>(FinanceEntityIdPrefix.BudgetStream, stream);
        entity.userId = userId;
        return entity;
    }
}
