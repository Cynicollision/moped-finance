import { NewEntity } from '@shared/core/types';
import { Account, BalanceHistory, BudgetStream, Category, CategoryGroup, Institution, Transaction } from '@shared/finance/types';
import { CoreEntityFactory } from '@server-core/utility';

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
        return CoreEntityFactory.generateId(prefix);
    }

    public static createAccount(userId: string, account: NewEntity<Account>): Account {
        const entity = CoreEntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, account);
        entity.userId = userId;
        return entity;
    }

    public static createBalanceHistory(accountId: string, history: NewEntity<BalanceHistory>): BalanceHistory {
        const entity = CoreEntityFactory.createEntity<BalanceHistory>(FinanceEntityIdPrefix.BalanceHistory, history);
        entity.accountId = accountId;
        return entity;
    }

    public static createTransaction(accountId: string, transaction: NewEntity<Transaction>): Transaction {
        const entity = CoreEntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, transaction);
        entity.accountId = accountId;
        return entity;
    }

    public static createInstitution(userId: string, institution: NewEntity<Institution>): Institution {
        const entity = CoreEntityFactory.createEntity<Institution>(FinanceEntityIdPrefix.Institution, institution);
        entity.userId = userId;
        return entity;
    }

    public static createCategory(userId: string, category: NewEntity<Category>): Category {
        const entity = CoreEntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, category);
        entity.userId = userId;
        return entity;
    }

    public static createCategoryGroup(userId: string, group: NewEntity<CategoryGroup>): CategoryGroup {
        const entity = CoreEntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
        entity.userId = userId;
        return entity;
    }

    public static createBudgetStream(userId: string, stream: NewEntity<BudgetStream>): BudgetStream {
        const entity = CoreEntityFactory.createEntity<BudgetStream>(FinanceEntityIdPrefix.BudgetStream, stream);
        entity.userId = userId;
        return entity;
    }
}
