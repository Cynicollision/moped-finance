import { FinanceBalanceHistoryData, IFinanceBalanceHistoryData } from './finance-data/balance-history-data';
import { FinanceBudgetStreamData, IFinanceBudgetStreamData } from './finance-data/budget-stream-data';
import { FinanceAccountData, IFinanceAccountData } from './finance-data/account-data';
import { FinanceCategoriesData, IFinanceCategoriesData } from './finance-data/categories-data';
import { FinanceInstitutionsData, IFinanceInstitutionsData } from './finance-data/institutions-data';
import { FinanceTransactionsData, IFinanceTransactionsData } from './finance-data/transactions-data';

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