import { OperationResult } from '@shared/common/contracts';
import { TransactionSearchOptions, SpendingStream } from '@shared/finance/contracts';
import { BudgetPeriod } from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil, ResultUtil } from '@core/utility';
import { IFinanceTransactionsData } from './../data/transactions-data';

export class TransactionController {
    constructor(
        private logger: AppLogger,
        private transactions: IFinanceTransactionsData
    ) {
    }

    public async getTransaction(userId: string, id: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactions.retrieveSingle(userId, id);
        if (!transaction) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(transaction);
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

    public async deleteTransaction(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.transactions.delete(userId, id);
        if (!deleted) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getTransactionSpendingByCategory(userId: string, period: BudgetPeriod, asOfDate: string): Promise<OperationResult<SpendingStream[]>> {
        const asOf = asOfDate ? new Date(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return ResultUtil.success(await this.transactions.retrieveSpendingByCategory(userId, startDate, endDate));
    }
}
