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
}