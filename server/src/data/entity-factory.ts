import { NewEntity } from '@shared/core/types';
import {
    Account,
    BalanceHistory,
    BudgetStreamFields,
    Category,
    CategoryGroup,
    Institution,
    Rule,
    Transaction
} from '@shared/finance/types';
import { BalanceEntrySource, CategorySource } from '@shared/finance/enum';
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
    BudgetStream = 'BS',
    Rule = 'RL',
    RuleCondition = 'RLC',
    RuleAction = 'RLA'
}

type TransactionDefaults =
    'adjustsBalance' | 'splitId' | 'isSynced' | 'categorySource' | 'categoryRuleId' | 'merchantRuleId';

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

    /** Adds the group and Asset/Liability that the type decides (ACCT-1.2). Manual until it's linked (ACCT-4.3). */
    public static createAccount(account: Omit<NewEntity<Account>, 'group' | 'category' | 'isManual'>): Account {
        return EntityFactory.createEntity<Account>(FinanceEntityIdPrefix.Account, {
            ...account,
            isManual: true,
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

    /**
     * Not split unless given a split ID (TXN-4). Its category is the user's, or none while it's Uncategorized, unless told
     * a rule set it (CAT-8.6).
     */
    public static createTransaction(
        transaction: Omit<NewEntity<Transaction>, TransactionDefaults> & Partial<Pick<Transaction, TransactionDefaults>>
    ): Transaction {
        return EntityFactory.createEntity<Transaction>(FinanceEntityIdPrefix.Transaction, {
            adjustsBalance: false,
            splitId: '',
            isSynced: false,
            categorySource: transaction.categoryId ? CategorySource.User : null,
            categoryRuleId: '',
            merchantRuleId: '',
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

    /** Saving it puts it at the end of the list (CAT-8.3), which sets its position. */
    public static createRule(rule: Omit<NewEntity<Rule>, 'position'>): Rule {
        return EntityFactory.createEntity<Rule>(FinanceEntityIdPrefix.Rule, { ...rule, position: 0 });
    }

    public static createBudgetStream(stream: NewEntity<BudgetStreamFields>): BudgetStreamFields {
        return EntityFactory.createEntity<BudgetStreamFields>(FinanceEntityIdPrefix.BudgetStream, stream);
    }
}
