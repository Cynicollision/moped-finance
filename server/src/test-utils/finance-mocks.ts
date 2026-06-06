import { IFinanceAccountData } from './../features/finance/data/account-data';
import { IFinanceBalanceHistoryData } from './../features/finance/data/balance-history-data';
import { IFinanceTransactionsData } from './../features/finance/data/transactions-data';
import { IFinanceBudgetStreamData } from './../features/finance/data/budget-stream-data';
import { IFinanceCategoriesData } from './../features/finance/data/categories-data';
import { IFinanceInstitutionsData } from './../features/finance/data/institutions-data';

export class FinanceMockUtil {
    public static createMockAccountData(): jest.Mocked<IFinanceAccountData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    }

    public static createMockBalanceHistoryData(): jest.Mocked<IFinanceBalanceHistoryData> {
        return {
            retrieveForAccount: jest.fn(),
            retrieveSumByDate: jest.fn()
        };
    }

    public static createMockTransactionsData(): jest.Mocked<IFinanceTransactionsData> {
        return {
            retrieveSingle: jest.fn(),
            search: jest.fn(),
            retrieveMerchants: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            retrieveSpendingByCategory: jest.fn()
        };
    }

    public static createMockBudgetStreamData(): jest.Mocked<IFinanceBudgetStreamData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    }

    public static createMockCategoriesData(): jest.Mocked<IFinanceCategoriesData> {
        return {
            retrieveSingle: jest.fn(),
            retrieveAll: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
    }

    public static createMockInstitutionsData(): jest.Mocked<IFinanceInstitutionsData> {
        return {
            retrieveSingle: jest.fn(),
            retrieveAll: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
    }
}
