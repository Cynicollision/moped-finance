import { SortDirection } from '@shared/core/enum';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';
import { GetAccountBalanceHistoryOptions, GetTransactionsOptions, ProfileValueHistory } from '@shared/finance/contracts';
import { TransactionsSortKey, TransactionsFilterKey, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, FinanceProfile, Institution, Transaction, BudgetStream } from '@shared/finance/types';
import { generateEntityId } from '../utility/id-util';
import { DatabaseError, databasePool } from './db-client';
import { FinanceBalanceHistoryData, IFinanceBalanceHistoryData } from './finance/balance-history-data';
import { FinanceBudgetStreamData, IFinanceBudgetStreamData } from './finance/budget-stream-data';
import { FinanceAccountData, IFinanceAccountData } from './finance/account-data';
import { FinanceCategoriesData, IFinanceCategoriesData } from './finance/categories-data';
import { FinanceInstitutionsData, IFinanceInstitutionsData } from './finance/institutions-data';
import { FinanceTransactionsData, IFinanceTransactionsData } from './finance/transactions-data';

export class FinanceData {

    constructor(
        readonly accounts: IFinanceAccountData,
        readonly balanceHistory: IFinanceBalanceHistoryData,
        readonly budgetStream: IFinanceBudgetStreamData,
        readonly categories: IFinanceCategoriesData,
        readonly institutions: IFinanceInstitutionsData,
        readonly transactions: IFinanceTransactionsData) {
    }

    public static forPgDatabase(): FinanceData {
        return new FinanceData(
            new FinanceAccountData(),
            new FinanceBalanceHistoryData(),
            new FinanceBudgetStreamData(),
            new FinanceCategoriesData(),
            new FinanceInstitutionsData(),
            new FinanceTransactionsData());
    }

    // TODO: remove entire FinanceProfile concept
    public async getProfile(userId: string): Promise<FinanceProfile | null> {
        try {
            const result = await databasePool.query(
                'SELECT id, user_id as "userId" FROM finance.profiles WHERE user_id = $1',
                [userId]
            );
            return result.rows[0] || null;
        }
        catch (err) {
            // TODO: something better with this, or capture error + handle in ApiHandler
            throw new DatabaseError();
        }
    }
}