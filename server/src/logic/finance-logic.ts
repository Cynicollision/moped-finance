import { EntityIdPrefix } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, SpendingStream, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, Institution, Transaction, BudgetStream } from '@shared/finance/types';
import { FinanceData } from './../data-access/finance-data';
import { AppLogger } from './../utility/logger';
import { DateTimeUtil } from './../utility/date-time';
import { EntityIdUtil } from './../utility/entity-id';

import { BaseLogic } from './base-logic';

export class FinanceLogic extends BaseLogic {
    constructor(logger: AppLogger, private financeData: FinanceData) {
        super(logger);
    }

    // Metadata
    public async getCategories(userId: string, activeOnly: boolean = false): Promise<Category[]> {
        const data = await this.financeData.categories.retrieveAll(userId, activeOnly);
        return data;
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        const data = await this.financeData.institutions.retrieveAll(userId);
        return data;
    }

    // Accounts
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
        return await this.execute(userId, 'getAccounts', () =>
            this.financeData.accounts.retrieveAll(userId)
        );
    }

    public async createAccount(userId: string, account: Account): Promise<Account> {
        return await this.execute(userId, 'createAccount', async () => {
            account.id = EntityIdUtil.generate(EntityIdPrefix.FinanceAccount);
            account.userId = userId;

            return await this.financeData.accounts.create(userId, account);
        });
    }

    public async saveAccount(userId: string, account: Account): Promise<Account> {
        // TODO: validate user ownership
        return await this.financeData.accounts.update(userId, account);
    }

    public async deleteAccount(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.accounts.delete(userId, id);
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[]> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const data = await this.financeData.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString());
        return data;
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<TotalValueHistory[]> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const data = await this.financeData.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate);

        return data;
    }

    // Transactions
    public async getTransaction(userId: string, id: string): Promise<Transaction | undefined> {
        return await this.financeData.transactions.retrieveSingle(userId, id);
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
        // TODO: validate options

        const data = await this.financeData.transactions.search(userId, options, accountId);
        return data;
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        const data = await this.financeData.transactions.retrieveMerchants(userId);
        return data;
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<Transaction> {
        // TODO: validate user ownership
        return await this.financeData.transactions.update(userId, transaction);
    }

    public async deleteTransaction(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.transactions.delete(userId, id);
    }

    // Budget
    public async getBudgetStreams(userId: string): Promise<BudgetStream[]> {
        const data = await this.financeData.budgetStream.retrieveAll(userId).catch(() => []);
        return data;
    }

    public async createBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        stream.id = EntityIdUtil.generate(EntityIdPrefix.FinanceBudgetStream);
        stream.userId = userId;

        return await this.financeData.budgetStream.insert(userId, stream);
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        // TODO: validate stream.userId matches, instead?
        stream.userId = userId;

        return await this.financeData.budgetStream.update(userId, stream);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.budgetStream.delete(userId, id);
    }

    // Cashflow
    public async getTransactionSpendingByCategory(userId: string, period: BudgetPeriod, asOfDate: string): Promise<SpendingStream[]> {
        const asOf = asOfDate ? new Date(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        const data = await this.financeData.transactions.retrieveSpendingByCategory(userId, startDate, endDate);
        return data;
    }
}