import { NewEntity } from '@shared/core/types';
import { Account, BalanceHistory, BudgetStream, Category, CategoryGroup, Institution, Transaction } from '@shared/finance/types';
import { DateTimeUtil } from '@server/utility';
import { EntityId } from './entity-id';

export enum CoreEntityIdPrefix {
    User = 'U',
    Log = 'LOG',
}

export enum FinanceEntityIdPrefix {
    Account = 'AC',
    BalanceHistory = 'BAL',
    Transaction = 'TRX',
    Institution = 'IN',
    Category = 'CT',
    CategoryGroup = 'CTG',
    BudgetStream = 'BS',
}

export class FinanceEntityFactory {

    private static createEntity<T extends { id: string, createdAt: Date, updatedAt: Date }>(prefix: string, newEntity: NewEntity<T>): T {
        return {
            ...newEntity,
            id: newEntity.id || EntityId.generate(prefix),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        } as unknown as T;
    }

    public static createAccount(account: NewEntity<Account>): Account {
        return FinanceEntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, account);
    }

    public static createBalanceHistory(history: NewEntity<BalanceHistory>): BalanceHistory {
        return FinanceEntityFactory.createEntity<BalanceHistory>(FinanceEntityIdPrefix.BalanceHistory, history);
    }

    public static createTransaction(transaction: NewEntity<Transaction>): Transaction {
        return FinanceEntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, transaction);
    }

    public static createInstitution(institution: NewEntity<Institution>): Institution {
        return FinanceEntityFactory.createEntity<Institution>(FinanceEntityIdPrefix.Institution, institution);
    }

    public static createCategory(category: NewEntity<Category>): Category {
        return FinanceEntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, category);
    }

    public static createCategoryGroup(group: NewEntity<CategoryGroup>): CategoryGroup {
        return FinanceEntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
    }

    public static createBudgetStream(stream: NewEntity<BudgetStream>): BudgetStream {
        return FinanceEntityFactory.createEntity<BudgetStream>(FinanceEntityIdPrefix.BudgetStream, stream);
    }
}
