import { IDatabaseClient } from '@core/interfaces';
import { FinanceBalanceHistoryData, IFinanceBalanceHistoryData } from './balance-history-data';
import { FinanceBudgetStreamData, IFinanceBudgetStreamData } from './budget-stream-data';
import { FinanceAccountData, IFinanceAccountData } from './account-data';
import { FinanceCategoriesData, IFinanceCategoriesData } from './categories-data';
import { FinanceInstitutionsData, IFinanceInstitutionsData } from './institutions-data';
import { FinanceTransactionsData, IFinanceTransactionsData } from './transactions-data';

export interface IFinanceData {
    readonly accounts: IFinanceAccountData;
    readonly balanceHistory: IFinanceBalanceHistoryData;
    readonly budgetStream: IFinanceBudgetStreamData;
    readonly categories: IFinanceCategoriesData;
    readonly institutions: IFinanceInstitutionsData;
    readonly transactions: IFinanceTransactionsData;
}

export class FinanceData implements IFinanceData {

    constructor(
        readonly accounts: IFinanceAccountData,
        readonly balanceHistory: IFinanceBalanceHistoryData,
        readonly budgetStream: IFinanceBudgetStreamData,
        readonly categories: IFinanceCategoriesData,
        readonly institutions: IFinanceInstitutionsData,
        readonly transactions: IFinanceTransactionsData) {
    }

    public static forPgDatabase(db: IDatabaseClient): FinanceData {
        return new FinanceData(
            new FinanceAccountData(db),
            new FinanceBalanceHistoryData(db),
            new FinanceBudgetStreamData(db),
            new FinanceCategoriesData(db),
            new FinanceInstitutionsData(db),
            new FinanceTransactionsData(db));
    }
}