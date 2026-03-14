import { GetTransactionsOptions, ProfileValueHistory, ProfileValueHistoryOptions } from '@shared/finance/contracts';
import { HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, FinanceProfile, Institution, Transaction } from '@shared/finance/types';
import { FinanceData } from './../data-access/finance-data';

export class FinanceLogic {
    private financeData: FinanceData;

    constructor(financeData: FinanceData) {
        this.financeData = financeData;
    }

    public async getProfile(userId: string): Promise<FinanceProfile> {
        const profile = await this.financeData.getProfile(userId);

        // TODO: Logic classes should validate and "throw" a Bad Request
        if (!profile) {
            throw new Error(`Error: Finance Profile not found for user ID: ${userId}`);
        }

        return profile;
    }

    public async getProfileValueHistory(usedId: string, options: ProfileValueHistoryOptions): Promise<ProfileValueHistory[]> {
        const endDate = options.asOfDate;
        let startDate = new Date(endDate);

        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;

        switch (options.timeframe) {
            case HistoryTimeframe.PastThirtyDays:
                startDate.setDate(startDate.getDate() - 30);
                break;
            case HistoryTimeframe.PastSixtyDays:
                startDate.setDate(startDate.getDate() - 60);
                break;
            case HistoryTimeframe.PastNinetyDays:
                startDate.setDate(startDate.getDate() - 90);
                break;
            case HistoryTimeframe.PastOneYear:
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case HistoryTimeframe.PastTwoYears:
                startDate.setFullYear(startDate.getFullYear() - 2);
                break;
            case HistoryTimeframe.PastFiveYears:
                startDate.setFullYear(startDate.getFullYear() - 5);
                break;
            case HistoryTimeframe.PastTenYears:
                startDate.setFullYear(startDate.getFullYear() - 10);
                break;
            case HistoryTimeframe.All:
                startDate = new Date(0); // Epoch start to represent "All"
                break;
            default:
                startDate.setDate(startDate.getDate() - 30); // Default to past 30 days
                break;
        }

        const data = await this.financeData.getProfileValueHistory(usedId, options.type, startDate, endDate);
        return data;
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<Category[]> {
        const data = await this.financeData.getCategories(userId, activeOnly);
        return data;
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        const data = await this.financeData.getInstitutions(userId);
        return data;
    }

    public async getAccount(userId: string, accountId: string): Promise<Account> {
        const data = await this.financeData.getAccount(userId, accountId);

        if (data) {
            return data;
        }
        else {
            // TODO: better bad request error handling
            throw new Error(`Error: Account not found for user ID: ${userId} and account ID: ${accountId}`);
        }
    }

    public async getAccounts(userId: string): Promise<Account[]> {
        const data = await this.financeData.getAccounts(userId);
        return data;
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetTransactionsOptions): Promise<BalanceHistory[]> {
        // TODO have options use HistoryTimeframe instead of fixed dates from client. pass dates to data layer
        const data = await this.financeData.getAccountBalanceHistory(userId, accountId, options);
        return data;
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
        const data = await this.financeData.getTransactions(userId, options, accountId);
        return data;
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        const data = await this.financeData.getTransactionMerchants(userId);
        return data;
    }
}