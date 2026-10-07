import { NewEntity } from '@shared/core/types';
import {
    Account,
    BalanceHistory,
    BudgetStreamFields,
    Category,
    CategoryGroup,
    Institution,
    Transaction
} from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { DateTimeUtil } from '@server/utility';
import { EntityId } from './entity-id';

export enum CoreEntityIdPrefix {
    User = 'U',
    Log = 'LOG',
    ApiToken = 'TOK'
}

export enum FinanceEntityIdPrefix {
    Account = 'AC',
    BalanceHistory = 'BAL',
    Transaction = 'TRX',
    Institution = 'IN',
    Category = 'CT',
    CategoryGroup = 'CTG',
    BudgetStream = 'BS'
}

export class FinanceEntityFactory {
    private static createEntity<T extends { id: string; createdAt: Date; updatedAt: Date }>(
        prefix: string,
        newEntity: NewEntity<T>
    ): T {
        return {
            ...newEntity,
            id: newEntity.id || EntityId.generate(prefix),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        } as unknown as T;
    }

    /** Adds the group and Asset/Liability that the type decides (ACCT-1.2). */
    public static createAccount(account: Omit<NewEntity<Account>, 'group' | 'category'>): Account {
        return FinanceEntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, {
            ...account,
            group: AccountTypeUtil.groupOf(account.type),
            category: AccountTypeUtil.categoryOf(account.type)
        });
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

    public static createCategory(
        category: Omit<NewEntity<Category>, 'necessity'> & Partial<Pick<Category, 'necessity'>>
    ): Category {
        return FinanceEntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, {
            necessity: null,
            ...category
        });
    }

    public static createCategoryGroup(group: NewEntity<CategoryGroup>): CategoryGroup {
        return FinanceEntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
    }

    public static createBudgetStream(stream: NewEntity<BudgetStreamFields>): BudgetStreamFields {
        return FinanceEntityFactory.createEntity<BudgetStreamFields>(FinanceEntityIdPrefix.BudgetStream, stream);
    }
}
