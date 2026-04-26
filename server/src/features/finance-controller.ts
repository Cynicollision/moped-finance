import { OperationResult } from '@shared/core/contracts';
import { EntityIdPrefix } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, SpendingStream, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, Institution, Transaction, BudgetStream } from '@shared/finance/types';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from './../utility';
import { IFinanceData } from './finance/data';

export class FinanceController {
    constructor(private financeData: IFinanceData) {
    }

    // Metadata
    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        return ResultUtil.success(await this.financeData.categories.retrieveAll(userId, activeOnly));
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        return ResultUtil.success(await this.financeData.institutions.retrieveAll(userId));
    }

    // Accounts
    public async getAccount(userId: string, id: string): Promise<OperationResult<Account>> {
        const account = await this.financeData.accounts.retrieveSingle(userId, id);
        if (!account) return ResultUtil.userError('Account not found or access denied');
        return ResultUtil.success(account);
    }

    public async getAccounts(userId: string): Promise<OperationResult<Account[]>> {
        return ResultUtil.success(await this.financeData.accounts.retrieveAll(userId));
    }

    public async createAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        account.id = EntityIdUtil.generate(EntityIdPrefix.FinanceAccount);
        account.userId = userId;

        return ResultUtil.success(await this.financeData.accounts.create(userId, account));
    }

    public async saveAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        const updated = await this.financeData.accounts.update(userId, account);
        if (!updated) return ResultUtil.userError('Account not found or access denied');
        return ResultUtil.success(updated);
    }

    public async deleteAccount(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.financeData.accounts.delete(userId, id);
        if (!deleted) return ResultUtil.userError('Account not found or access denied');
        return ResultUtil.success();
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<OperationResult<BalanceHistory[]>> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.financeData.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString()));
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<OperationResult<TotalValueHistory[]>> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;
        // TODO: validate options

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.financeData.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate));
    }

    // Transactions
    public async getTransaction(userId: string, id: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.financeData.transactions.retrieveSingle(userId, id);
        if (!transaction) return ResultUtil.userError('Transaction not found or access denied');
        return ResultUtil.success(transaction);
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        return ResultUtil.success(await this.financeData.transactions.search(userId, options, accountId));
    }

    public async getTransactionMerchants(userId: string): Promise<OperationResult<string[]>> {
        return ResultUtil.success(await this.financeData.transactions.retrieveMerchants(userId));
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        const updated = await this.financeData.transactions.update(userId, transaction);
        if (!updated) return ResultUtil.userError('Transaction not found or access denied');
        return ResultUtil.success(updated);
    }

    public async deleteTransaction(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.financeData.transactions.delete(userId, id);
        if (!deleted) return ResultUtil.userError('Transaction not found or access denied');
        return ResultUtil.success();
    }

    // Budget
    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.financeData.budgetStream.retrieveAll(userId).catch(() => []);
        return ResultUtil.success(streams);
    }

    public async createBudgetStream(userId: string, stream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        stream.id = EntityIdUtil.generate(EntityIdPrefix.FinanceBudgetStream);
        stream.userId = userId;

        return ResultUtil.success(await this.financeData.budgetStream.insert(userId, stream));
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const updated = await this.financeData.budgetStream.update(userId, stream);
        if (!updated) return ResultUtil.userError('Budget stream not found or access denied');
        return ResultUtil.success(updated);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.financeData.budgetStream.delete(userId, id);
        if (!deleted) return ResultUtil.userError('Budget stream not found or access denied');
        return ResultUtil.success();
    }

    // Cashflow
    public async getTransactionSpendingByCategory(userId: string, period: BudgetPeriod, asOfDate: string): Promise<OperationResult<SpendingStream[]>> {
        const asOf = asOfDate ? new Date(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return ResultUtil.success(await this.financeData.transactions.retrieveSpendingByCategory(userId, startDate, endDate));
    }
}