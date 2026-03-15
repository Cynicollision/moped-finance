import { GetAccountBalanceHistoryOptions, GetTransactionsOptions, ProfileValueHistory, ProfileValueHistoryOptions } from '@shared/finance/contracts';
import { HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, FinanceProfile, Institution, Transaction, BudgetStream } from '@shared/finance/types';
import { FinanceData } from './../data-access/finance-data';
import { getStartDateForTimeframe } from './../utility/date-time-util';

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

    public async getProfileValueHistory(userId: string, options: ProfileValueHistoryOptions): Promise<ProfileValueHistory[]> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;

        const startDate = getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const data = await this.financeData.getProfileValueHistory(userId, options.type, startDate, options.asOfDate);

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

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[]> {
        const startDate = getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const data = await this.financeData.getAccountBalanceHistory(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString());
        return data;
    }

    public async getBudgetStreams(userId: string): Promise<BudgetStream[]> {
        const data = await this.financeData.getBudgetStreams(userId).catch(() => []);
        return data;
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        return await this.financeData.saveBudgetStream(userId, stream);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<void> {
        await this.financeData.deleteBudgetStream(userId, id);
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