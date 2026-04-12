import { EntityIdPrefix } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, SpendingStream, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, Institution, Transaction, BudgetStream } from '@shared/finance/types';
import { DateTimeUtil } from './../utility/date-time';
import { EntityIdUtil } from './../utility/entity-id';
import { BadRequestError, ForbiddenError } from './../utility/errors';
import { FinanceData } from './finance-data';

export class FinanceLogic {
    constructor(private financeData: FinanceData) {
    }

    // Metadata
    public async getCategories(userId: string, activeOnly: boolean = false): Promise<Category[]> {
        return this.financeData.categories.retrieveAll(userId, activeOnly);
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        return this.financeData.institutions.retrieveAll(userId);
    }

    // Accounts
    public async getAccount(userId: string, id: string): Promise<Account> {
        const result = await this.financeData.accounts.retrieveSingle(userId, id);
        if (!result) {
            throw new BadRequestError(`Account not found or access denied for ID: ${id}`);
        }
        return result;
    }

    public async getAccounts(userId: string): Promise<Account[]> {
        return this.financeData.accounts.retrieveAll(userId);
    }

    public async createAccount(userId: string, account: Account): Promise<Account> {
        account.id = EntityIdUtil.generate(EntityIdPrefix.FinanceAccount);
        account.userId = userId;

        return this.financeData.accounts.create(userId, account);
    }

    public async saveAccount(userId: string, account: Account): Promise<Account> {
        // TODO: validate user ownership
        return this.financeData.accounts.update(userId, account);
    }

    public async deleteAccount(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.accounts.delete(userId, id);
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[]> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return this.financeData.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString());
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<TotalValueHistory[]> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return this.financeData.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate);
    }

    // Transactions
    public async getTransaction(userId: string, id: string): Promise<Transaction | undefined> {
        return this.financeData.transactions.retrieveSingle(userId, id);
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
        // TODO: validate options
        return this.financeData.transactions.search(userId, options, accountId);
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        return this.financeData.transactions.retrieveMerchants(userId);
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<Transaction> {
        // TODO: validate user ownership
        return this.financeData.transactions.update(userId, transaction);
    }

    public async deleteTransaction(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.transactions.delete(userId, id);
    }

    // Budget
    public async getBudgetStreams(userId: string): Promise<BudgetStream[]> {
        return this.financeData.budgetStream.retrieveAll(userId).catch(() => []);
    }

    public async createBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        stream.id = EntityIdUtil.generate(EntityIdPrefix.FinanceBudgetStream);
        stream.userId = userId;

        return this.financeData.budgetStream.insert(userId, stream);
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        // TODO: validate stream.userId matches, instead?
        stream.userId = userId;

        return this.financeData.budgetStream.update(userId, stream);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<void> {
        // TODO: validate user ownership
        await this.financeData.budgetStream.delete(userId, id);
    }

    // Cashflow
    public async getTransactionSpendingByCategory(userId: string, period: BudgetPeriod, asOfDate: string): Promise<SpendingStream[]> {
        const asOf = asOfDate ? new Date(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return this.financeData.transactions.retrieveSpendingByCategory(userId, startDate, endDate);
    }
}