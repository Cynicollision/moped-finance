import { OperationResult } from '@shared/core/contracts';
import { CalendarPeriod } from '@shared/core/enum';
import { FinanceEntityIdPrefix } from '@shared/finance/enum';
import { TransactionSearchOptions, SpendingStream } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceTransactionsData } from './transaction-data';

export class TransactionController {
    private readonly logger: AppLogger;
    private readonly transactions: IFinanceTransactionsData;

    constructor(logger: AppLogger, transactions: IFinanceTransactionsData) {
        this.logger = logger;
        this.transactions = transactions;
    }

    public async getTransaction(userId: string, transactionId: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactions.retrieveSingle(userId, transactionId);
        if (!transaction) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(transaction);
    }

    public async createTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        transaction.id = EntityIdUtil.generate(FinanceEntityIdPrefix.Transaction);
        return ResultUtil.success(await this.transactions.insert(userId, transaction));
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        return ResultUtil.success(await this.transactions.search(userId, options, accountId));
    }

    public async getTransactionMerchants(userId: string): Promise<OperationResult<string[]>> {
        return ResultUtil.success(await this.transactions.retrieveMerchants(userId));
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        const updated = await this.transactions.update(userId, transaction);
        if (!updated) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteTransaction(userId: string, transactionId: string): Promise<OperationResult<void>> {
        const deleted = await this.transactions.delete(userId, transactionId);
        if (!deleted) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getTransactionSpendingByCategory(userId: string, period: CalendarPeriod, asOfDate: string): Promise<OperationResult<SpendingStream[]>> {
        const asOf = asOfDate ? DateTimeUtil.parse(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return ResultUtil.success(await this.transactions.retrieveSpendingByCategory(userId, startDate, endDate));
    }

    public async exportTransactions(userId: string, options: { format?: string; startDate?: string; endDate?: string; accountId?: string }): Promise<OperationResult<any>> {
        // TODO: implement export logic
        return ResultUtil.success({ message: 'Export logic stub' });
    }

    public async importTransactions(userId: string, options: { dryRun?: boolean; body?: any }): Promise<OperationResult<any>> {
        // TODO: implement import logic
        return ResultUtil.success({ message: 'Import logic stub' });
    }
}
