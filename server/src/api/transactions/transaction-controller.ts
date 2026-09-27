import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { CashflowStream, TransactionImportResult, TransactionSearchOptions } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoryData } from './../categories/category-data';
import { TransactionCsv } from './transaction-csv';
import { IFinanceTransactionData } from './transaction-data';
import { CreateTransactionRequest, UpdateTransactionRequest } from './transaction-schema';

export class TransactionController {
    constructor(
        private logger: IAppLogger,
        private accountData: IFinanceAccountData,
        private categoryData: IFinanceCategoryData,
        private transactionData: IFinanceTransactionData
    ) {
    }

    public async getTransaction(context: OperationContext, transactionId: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactionData.retrieveSingle(transactionId);
        if (!transaction) {
            return Result.userErrorNotFound();
        }
        return Result.success(transaction);
    }

    public async createTransaction(context: OperationContext, input: CreateTransactionRequest): Promise<OperationResult<Transaction>> {
        // A missing account or category fails the insert's foreign key, which OperationHandler reports as a 400.
        const transaction = FinanceEntityFactory.createTransaction({
            ...input,
            isHidden: input.isHidden ?? false,
            isSplit: input.isSplit ?? false
        });

        const created = await this.transactionData.insert(transaction);
        return Result.successCreated(created);
    }

    public async getTransactions(context: OperationContext, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        const transactions = await this.transactionData.search(options, accountId);
        return Result.success(transactions);
    }

    public async getTransactionMerchants(context: OperationContext): Promise<OperationResult<string[]>> {
        const merchantNames = await this.transactionData.retrieveMerchants();
        return Result.success(merchantNames);
    }

    public async saveTransaction(context: OperationContext, transactionId: string, changes: UpdateTransactionRequest): Promise<OperationResult<Transaction>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const updated = await this.transactionData.update({ ...current, ...changes });
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteTransaction(context: OperationContext, transactionId: string): Promise<OperationResult<void>> {
        const deleted = await this.transactionData.delete(transactionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async getTransactionCashflowByCategory(context: OperationContext, period: CalendarPeriod, asOfDate?: CalendarDate): Promise<OperationResult<CashflowStream[]>> {
        const { startDate, endDate } = CalendarDateUtil.getPeriod(period, asOfDate ?? DateTimeUtil.today());
        const cashflow = await this.transactionData.retrieveCashflowByCategory(startDate, endDate);
        return Result.success(cashflow);
    }

    public async exportTransactions(context: OperationContext, accountId?: string): Promise<OperationResult<string>> {
        const timestamp = DateTimeUtil.nowToISOSafeFilename();
        let fileName = `Transactions_${timestamp}.csv`;

        if (accountId) {
            const account = await this.accountData.retrieveSingle(accountId);
            if (!account) {
                return Result.userErrorNotFound();
            }
            fileName = `Transactions_${account.name.replace(/[^a-zA-Z0-9]/g, '-')}_${timestamp}.csv`;
        }

        const transactions = await this.transactionData.retrieveForExport(accountId);
        return Result.successFile('text/csv', fileName, TransactionCsv.write(transactions));
    }

    public async importTransactions(context: OperationContext, file: Buffer | undefined, dryRun: boolean, targetAccountId?: string): Promise<OperationResult<TransactionImportResult>> {
        // Checked up front: a dry run inserts nothing, so the foreign key can't catch a bad account.
        if (targetAccountId && !(await this.accountData.retrieveSingle(targetAccountId))) {
            return Result.userError('Account not found.');
        }

        const [accounts, categories] = await Promise.all([
            this.accountData.retrieveAll(),
            this.categoryData.retrieveAll()
        ]);

        const csv = TransactionCsv.read(file, {
            accountIds: new Map(accounts.map(a => [a.name.toLowerCase(), a.id])),
            categoryIds: new Map(categories.map(c => [c.name.toLowerCase(), c.id])),
            targetAccountId
        });

        if (!csv.success) {
            return Result.userError(csv.message);
        }

        const { transactions, failedRowMessages } = csv;
        const isValidToImport = failedRowMessages.length === 0;

        // All or nothing: a file with any bad row saves nothing. The dry run reports the rows so the user
        // can fix the file; a real import of a bad file (which the client doesn't send) is a 400.
        if (!isValidToImport) {
            const summary = `Found errors in ${failedRowMessages.length} of ${transactions.length + failedRowMessages.length} rows.`;
            const result: TransactionImportResult = { createdCount: 0, failedRowMessages, isValidToImport, resultMessage: summary };
            return dryRun
                ? Result.success(result)
                : Result.userError(`Nothing was imported. ${summary}`, 'INVALID_IMPORT', result);
        }

        if (dryRun) {
            return Result.success({ createdCount: transactions.length, failedRowMessages, isValidToImport, resultMessage: `Ready to import ${transactions.length} transactions.` });
        }

        await this.transactionData.insertBulk(transactions);
        return Result.successCreated({ createdCount: transactions.length, failedRowMessages, isValidToImport, resultMessage: `Imported ${transactions.length} transactions.` });
    }
}
