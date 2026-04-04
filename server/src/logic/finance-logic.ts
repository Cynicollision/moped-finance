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
        return await this.execute(userId, 'getCategories', () =>
            this.financeData.categories.retrieveAll(userId, activeOnly)
        );
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        return await this.execute(userId, 'getInstitutions', () =>
            this.financeData.institutions.retrieveAll(userId)
        );
    }

    // Accounts
    public async getAccount(userId: string, accountId: string): Promise<Account> {
        return await this.execute(userId, 'getAccount', async () => {
            const data = await this.financeData.accounts.retrieveSingle(userId, accountId);
            if (data) {
                return data;
            }
            else {
                // TODO: better bad request error handling
                throw new Error(`Error: Account not found for user ID: ${userId} and account ID: ${accountId}`);
            }
        });
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
        return await this.execute(userId, 'saveAccount', async () => {
            // TODO: validate user ownership
            return await this.financeData.accounts.update(userId, account);
        });
    }

    public async deleteAccount(userId: string, id: string): Promise<void> {
        return await this.execute(userId, 'deleteAccount', async () => {
            // TODO: validate user ownership
            await this.financeData.accounts.delete(userId, id);
        });
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[]> {
        return await this.execute(userId, 'getAccountBalanceHistory', async () => {
            const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
            return await this.financeData.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString());
        });
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<TotalValueHistory[]> {
        return await this.execute(userId, 'getTotalValueHistory', async () => {
            options.type = options.type || ValueHistoryType.NetWorth;
            options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;

            const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
            return await this.financeData.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate);
        });
    }

    // Transactions
    public async getTransaction(userId: string, id: string): Promise<Transaction | undefined> {
        return await this.execute(userId, 'getTransaction', () =>
            this.financeData.transactions.retrieveSingle(userId, id)
        );
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
        return await this.execute(userId, 'getTransactions', async () => {
            // TODO: validate options
            return await this.financeData.transactions.search(userId, options, accountId);
        });
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        return await this.execute(userId, 'getTransactionMerchants', () =>
            this.financeData.transactions.retrieveMerchants(userId)
        );
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<Transaction> {
        return await this.execute(userId, 'saveTransaction', async () => {
            // TODO: validate user ownership
            return await this.financeData.transactions.update(userId, transaction);
        });
    }

    public async deleteTransaction(userId: string, id: string): Promise<void> {
        return await this.execute(userId, 'deleteTransaction', async () => {
            // TODO: validate user ownership
            await this.financeData.transactions.delete(userId, id);
        });
    }

    // Budget
    public async getBudgetStreams(userId: string): Promise<BudgetStream[]> {
        return await this.execute(userId, 'getBudgetStreams', async () => {
            return await this.financeData.budgetStream.retrieveAll(userId).catch(() => []);
        });
    }

    public async createBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        return await this.execute(userId, 'createBudgetStream', async () => {
            stream.id = EntityIdUtil.generate(EntityIdPrefix.FinanceBudgetStream);
            stream.userId = userId;

            return await this.financeData.budgetStream.insert(userId, stream);
        });
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        return await this.execute(userId, 'saveBudgetStream', async () => {
            // TODO: validate stream.userId matches, instead?
            stream.userId = userId;

            return await this.financeData.budgetStream.update(userId, stream);
        });
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<void> {
        return await this.execute(userId, 'deleteBudgetStream', async () => {
            // TODO: validate user ownership
            await this.financeData.budgetStream.delete(userId, id);
        });
    }

    // Cashflow
    public async getTransactionSpendingByCategory(userId: string, period: BudgetPeriod, asOfDate: string): Promise<SpendingStream[]> {
        return await this.execute(userId, 'getTransactionSpendingByCategory', async () => {
            const asOf = asOfDate ? new Date(asOfDate) : DateTimeUtil.now();
            const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
            return await this.financeData.transactions.retrieveSpendingByCategory(userId, startDate, endDate);
        });
    }
}