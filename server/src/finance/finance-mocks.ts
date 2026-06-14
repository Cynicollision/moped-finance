import { IFinanceAccountData, IFinanceBalanceHistoryData } from './accounts';
import { IFinanceBudgetStreamData } from './budget';
import { IFinanceCategoryData } from './categories';
import { IFinanceInstitutionData } from './institutions';
import { IFinanceTransactionData } from './transactions';

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
            retrieveSumByDate: jest.fn(),
            deleteRange: jest.fn(),
            insertBulk: jest.fn(),
            exportSearch: jest.fn()
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

    public static createMockCategoriesData(): jest.Mocked<IFinanceCategoryData> {
        return {
            retrieveSingle: jest.fn(),
            retrieveAll: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
    }

    public static createMockInstitutionsData(): jest.Mocked<IFinanceInstitutionData> {
        return {
            retrieveSingle: jest.fn(),
            retrieveAll: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
    }

    public static createMockTransactionsData(): jest.Mocked<IFinanceTransactionData> {
        return {
            retrieveSingle: jest.fn(),
            search: jest.fn(),
            exportSearch: jest.fn(),
            retrieveMerchants: jest.fn(),
            update: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
            retrieveCashflowByCategory: jest.fn()
        };
    }
}
