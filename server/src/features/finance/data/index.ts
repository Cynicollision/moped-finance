import { DatabaseClient } from '@core/db';
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

    public static forDatabase(db: DatabaseClient): FinanceData {
        return new FinanceData(
            new FinanceAccountData(db.drizzle),
            new FinanceBalanceHistoryData(db.drizzle),
            new FinanceBudgetStreamData(db.drizzle),
            new FinanceCategoriesData(db.drizzle),
            new FinanceInstitutionsData(db.drizzle),
            new FinanceTransactionsData(db.drizzle));
    }
}