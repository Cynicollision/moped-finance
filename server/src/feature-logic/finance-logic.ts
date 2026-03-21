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
        const data = await this.financeData.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate);

        return data;
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<Category[]> {
        const data = await this.financeData.categories.retrieveAll(userId, activeOnly);
        return data;
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        const data = await this.financeData.institutions.retrieveAll(userId);
        return data;
    }

    public async getAccount(userId: string, accountId: string): Promise<Account> {
        const data = await this.financeData.accounts.retrieveSingle(userId, accountId);

        if (data) {
            return data;
        }
        else {
            // TODO: better bad request error handling
            throw new Error(`Error: Account not found for user ID: ${userId} and account ID: ${accountId}`);
        }
    }

    public async getAccounts(userId: string): Promise<Account[]> {
        const data = await this.financeData.accounts.retrieveAll(userId);
        return data;
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[]> {
        const startDate = getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const data = await this.financeData.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString());
        return data;
    }

    public async getBudgetStreams(userId: string): Promise<BudgetStream[]> {
        const data = await this.financeData.budgetStream.retrieveAll(userId).catch(() => []);
        return data;
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        return await this.financeData.budgetStream.insert(userId, stream);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<void> {
        await this.financeData.budgetStream.delete(userId, id);
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
        const data = await this.financeData.transactions.search(userId, options, accountId);
        return data;
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        const data = await this.financeData.transactions.retrieveMerchants(userId);
        return data;
    }
}