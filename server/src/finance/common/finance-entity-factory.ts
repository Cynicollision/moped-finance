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

    public static createAccount(account: NewEntity<Account>): Account {
        return CoreEntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, account);
    }

    public static createBalanceHistory(history: NewEntity<BalanceHistory>): BalanceHistory {
        return CoreEntityFactory.createEntity<BalanceHistory>(FinanceEntityIdPrefix.BalanceHistory, history);
    }

    public static createTransaction(transaction: NewEntity<Transaction>): Transaction {
        return CoreEntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, transaction);
    }

    public static createInstitution(institution: NewEntity<Institution>): Institution {
        return CoreEntityFactory.createEntity<Institution>(FinanceEntityIdPrefix.Institution, institution);
    }

    public static createCategory(category: NewEntity<Category>): Category {
        return CoreEntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, category);
    }

    public static createCategoryGroup(group: NewEntity<CategoryGroup>): CategoryGroup {
        return CoreEntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
    }

    public static createBudgetStream(stream: NewEntity<BudgetStream>): BudgetStream {
        return CoreEntityFactory.createEntity<BudgetStream>(FinanceEntityIdPrefix.BudgetStream, stream);
    }
}
