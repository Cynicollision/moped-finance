import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import {
    SpendingAverage,
    SpendingTotal,
    TransactionImportResult,
    TransactionSearchOptions
} from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { TransactionSplit } from '@shared/finance/util';
import { FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoryData } from './../categories/category-data';
import { Spending } from './spending';
import { TransactionCsv } from './transaction-csv';
import { adjustmentChange, IFinanceTransactionData } from './transaction-data';
import { CreateTransactionRequest, SplitTransactionRequest, UpdateTransactionRequest } from './transaction-schema';

export class TransactionController {
    constructor(
        private logger: IAppLogger,
        private accountData: IFinanceAccountData,
        private categoryData: IFinanceCategoryData,
        private transactionData: IFinanceTransactionData
    ) {}

    public async getTransaction(
        context: OperationContext,
        transactionId: string
    ): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactionData.retrieveSingle(transactionId);
        if (!transaction) {
            return Result.userErrorNotFound();
        }
        return Result.success(transaction);
    }

    public async createTransaction(
        context: OperationContext,
        input: CreateTransactionRequest
    ): Promise<OperationResult<Transaction>> {
        // A missing account or category fails the insert's foreign key, which OperationHandler reports as a 400.
        const transaction = FinanceEntityFactory.createTransaction({
            ...input,
            isHidden: input.isHidden ?? false,
            adjustsBalance: input.adjustsBalance ?? false
        });

        const refusal = await this.checkAdjustment(null, transaction);
        if (refusal) {
            return Result.userError(refusal);
        }

        const created = await this.transactionData.insert(transaction);
        return Result.successCreated(created);
    }

    public async getTransactions(
        context: OperationContext,
        options: TransactionSearchOptions,
        accountId?: string
    ): Promise<OperationResult<Transaction[]>> {
        const transactions = await this.transactionData.search(options, accountId);
        return Result.success(transactions);
    }

    public async getTransactionMerchants(_context: OperationContext): Promise<OperationResult<string[]>> {
        const merchantNames = await this.transactionData.retrieveMerchants();
        return Result.success(merchantNames);
    }

    public async saveTransaction(
        context: OperationContext,
        transactionId: string,
        changes: UpdateTransactionRequest
    ): Promise<OperationResult<Transaction>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const transaction = { ...current, ...changes };
        // A split transaction's total, date and account stay put, and its parts have the categories (TXN-4.7).
        if (current.parts.length > 0) {
            const { amount, date, accountId, categoryId } = transaction;
            if (amount !== current.amount || date !== current.date || accountId !== current.accountId) {
                return Result.userError('Unsplit this transaction to change its amount, date or account.');
            }
            if (categoryId) {
                return Result.userError("A split transaction's parts have its categories.");
            }
        }

        const refusal = await this.checkAdjustment(current, transaction);
        if (refusal) {
            return Result.userError(refusal);
        }

        const updated = await this.transactionData.update(transaction);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    /** Splits a transaction, or replaces the parts of one that's split (TXN-4.1, TXN-4.2, TXN-4.5). */
    public async splitTransaction(
        context: OperationContext,
        transactionId: string,
        input: SplitTransactionRequest
    ): Promise<OperationResult<Transaction>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current) {
            return Result.userErrorNotFound();
        }
        const remainder = TransactionSplit.remainder(
            current.amount,
            input.parts.map(p => p.amount)
        );
        if (remainder !== 0) {
            return Result.userError("The parts' amounts must add up to the transaction's amount.");
        }

        // A missing category fails the insert's foreign key, which OperationHandler reports as a 400.
        const split = await this.transactionData.split(transactionId, input.parts);
        return split ? Result.successUpdated(split) : Result.userErrorNotFound();
    }

    /** Turns a split transaction back into one, with its first part's category, merchant and notes (TXN-4.5). */
    public async unsplitTransaction(
        context: OperationContext,
        transactionId: string
    ): Promise<OperationResult<Transaction>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current) {
            return Result.userErrorNotFound();
        }
        if (current.parts.length === 0) {
            return Result.userError("This transaction isn't split.");
        }

        const unsplit = await this.transactionData.unsplit(transactionId);
        return unsplit ? Result.successUpdated(unsplit) : Result.userErrorNotFound();
    }

    public async deleteTransaction(context: OperationContext, transactionId: string): Promise<OperationResult<void>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current) {
            return Result.userErrorNotFound();
        }
        const refusal = await this.checkAdjustment(current, null);
        if (refusal) {
            return Result.userError(refusal);
        }

        const deleted = await this.transactionData.delete(transactionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    /**
     * Why a transaction can't be saved as `after` (or deleted, when it's null) because of its balance change, if it
     * can't. Only a manual account's transactions adjust the balance (ACCT-5.5), and a closed account's balances don't
     * change until it's reopened (ACCT-6.3).
     */
    private async checkAdjustment(before: Transaction | null, after: Transaction | null): Promise<string | null> {
        const { undo, apply } = adjustmentChange(before, after);
        const accountIds = new Set([undo?.accountId, apply?.accountId]);
        if (after?.adjustsBalance) {
            accountIds.add(after.accountId);
        }
        accountIds.delete(undefined);

        for (const accountId of accountIds) {
            const account = await this.accountData.retrieveSingle(accountId!);
            // A missing account is left to the foreign key (TXN-2.5).
            if (!account) {
                continue;
            }
            if (after?.adjustsBalance && after.accountId === accountId && !account.isManual) {
                return "A connected account's balance comes from its bank.";
            }
            if (account.closedOn && (undo?.accountId === accountId || apply?.accountId === accountId)) {
                return 'Reopen this account to change its balance.';
            }
        }
        return null;
    }

    public async getSpendingByCategory(
        context: OperationContext,
        period: CalendarPeriod,
        asOfDate?: CalendarDate
    ): Promise<OperationResult<SpendingTotal[]>> {
        const { startDate, endDate } = CalendarDateUtil.getPeriod(period, asOfDate ?? DateTimeUtil.today());
        const flows = await this.transactionData.retrieveCategoryFlows(startDate, endDate);
        return Result.success(Spending.totals(flows));
    }

    public async getSpendingAverage(
        context: OperationContext,
        asOfDate?: CalendarDate
    ): Promise<OperationResult<SpendingAverage>> {
        const firstDate = await this.transactionData.retrieveFirstDate();
        const window = Spending.averageWindow(asOfDate ?? DateTimeUtil.today(), firstDate);
        const flows =
            window.months > 0 ? await this.transactionData.retrieveCategoryFlows(window.startDate, window.endDate) : [];
        return Result.success(Spending.average(flows, window));
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

    public async importTransactions(
        context: OperationContext,
        file: Buffer | undefined,
        dryRun: boolean,
        targetAccountId?: string,
        adjustBalances = false
    ): Promise<OperationResult<TransactionImportResult>> {
        // Checked up front: a dry run inserts nothing, so the foreign key can't catch a bad account.
        const targetAccount = targetAccountId ? await this.accountData.retrieveSingle(targetAccountId) : null;
        if (targetAccountId && !targetAccount) {
            return Result.userError('Account not found.');
        }
        // Only an import into one manual, open account adjusts balances (TXN-3.11, ACCT-5.5, ACCT-6.3).
        if (adjustBalances) {
            if (!targetAccount) {
                return Result.userError('Import into an account to adjust its balances.');
            }
            if (!targetAccount.isManual) {
                return Result.userError("A connected account's balance comes from its bank.");
            }
            if (targetAccount.closedOn) {
                return Result.userError('Reopen this account to change its balance.');
            }
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

        const { transactions, failedRowMessages, unmatchedCategories } = csv;
        const isValidToImport = failedRowMessages.length === 0;
        const uncategorizedCount = transactions.filter(t => !t.categoryId).length;
        const report = { failedRowMessages, isValidToImport, uncategorizedCount, unmatchedCategories };

        // All or nothing: a file with any bad row saves nothing. The dry run reports the rows so the user
        // can fix the file; a real import of a bad file (which the client doesn't send) is a 400.
        if (!isValidToImport) {
            const summary = `Found errors in ${failedRowMessages.length} of ${transactions.length + failedRowMessages.length} rows.`;
            const result: TransactionImportResult = { ...report, createdCount: 0, resultMessage: summary };
            return dryRun
                ? Result.success(result)
                : Result.userError(`Nothing was imported. ${summary}`, 'INVALID_IMPORT', result);
        }

        if (dryRun) {
            return Result.success({
                ...report,
                createdCount: transactions.length,
                resultMessage: `Ready to import ${transactions.length} transactions.`
            });
        }

        await this.transactionData.insertBulk(transactions.map(t => ({ ...t, adjustsBalance: adjustBalances })));
        return Result.successCreated({
            ...report,
            createdCount: transactions.length,
            resultMessage: `Imported ${transactions.length} transactions.`
        });
    }
}
