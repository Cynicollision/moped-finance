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
import { BalanceEntrySource } from '@shared/finance/enum';
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
    TransactionSplit = 'SPL',
    Institution = 'IN',
    Category = 'CT',
    CategoryGroup = 'CTG',
    BudgetStream = 'BS'
}

export class EntityFactory {
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
        return EntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, {
            ...account,
            group: AccountTypeUtil.groupOf(account.type),
            category: AccountTypeUtil.categoryOf(account.type)
        });
    }

    /** A set entry unless told otherwise (ACCT-5.1). */
    public static createBalanceHistory(
        history: Omit<NewEntity<BalanceHistory>, 'source'> & Partial<Pick<BalanceHistory, 'source'>>
    ): BalanceHistory {
        return EntityFactory.createEntity<BalanceHistory>(FinanceEntityIdPrefix.BalanceHistory, {
            source: BalanceEntrySource.Set,
            ...history
        });
    }

    /** Not split unless given a split ID (TXN-4). */
    public static createTransaction(
        transaction: Omit<NewEntity<Transaction>, 'adjustsBalance' | 'splitId'> &
            Partial<Pick<Transaction, 'adjustsBalance' | 'splitId'>>
    ): Transaction {
        return EntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, {
            adjustsBalance: false,
            splitId: '',
            ...transaction
        });
    }

    /** The ID the parts of a new split share (TXN-4). */
    public static createSplitId(): string {
        return EntityId.generate(FinanceEntityIdPrefix.TransactionSplit);
    }

    public static createInstitution(institution: NewEntity<Institution>): Institution {
        return EntityFactory.createEntity<Institution>(FinanceEntityIdPrefix.Institution, institution);
    }

    public static createCategory(
        category: Omit<NewEntity<Category>, 'necessity'> & Partial<Pick<Category, 'necessity'>>
    ): Category {
        return EntityFactory.createEntity<Category>(FinanceEntityIdPrefix.Category, {
            necessity: null,
            ...category
        });
    }

    public static createCategoryGroup(group: NewEntity<CategoryGroup>): CategoryGroup {
        return EntityFactory.createEntity<CategoryGroup>(FinanceEntityIdPrefix.CategoryGroup, group);
    }

    public static createBudgetStream(stream: NewEntity<BudgetStreamFields>): BudgetStreamFields {
        return EntityFactory.createEntity<BudgetStreamFields>(FinanceEntityIdPrefix.BudgetStream, stream);
    }
}
