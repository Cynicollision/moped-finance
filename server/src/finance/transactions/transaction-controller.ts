import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { CalendarPeriod } from '@shared/core/enum';
import { CashflowStream, TransactionImportResult, TransactionSearchOptions } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { FinanceEntityFactory } from '@server-core/data';
import { IAppLogger } from '@server-core/logging';
import { OperationContext, Result } from '@server-core/routing';
import { DateTimeUtil } from '@server-core/utility';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoryData } from './../categories/category-data';
import { IFinanceTransactionData } from './transaction-data';

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
        if (!transaction || !context.user.canAccess(transaction)) {
            return Result.userErrorNotFound();
        }
        return Result.success(transaction);
    }

    public async createTransaction(context: OperationContext, newTransaction: NewEntity<Transaction>): Promise<OperationResult<Transaction>> {
        const transaction = FinanceEntityFactory.createTransaction(context.user.getId(), newTransaction);

        const account = await this.accountData.retrieveSingle(transaction.accountId);
        if (!account || !context.user.canAccess(account)) {
            return Result.userError('Invalid account specified.');
        }

        const created = await this.transactionData.insert(transaction);
        return Result.successCreated(created);
    }

    public async getTransactions(context: OperationContext, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        const transactions = await this.transactionData.search(context.user.getId(), options, accountId);
        return Result.success(transactions);
    }

    public async getTransactionMerchants(context: OperationContext): Promise<OperationResult<string[]>> {
        const merchantNames = await this.transactionData.retrieveMerchants(context.user.getId());
        return Result.success(merchantNames);
    }

    public async saveTransaction(context: OperationContext, transaction: Transaction): Promise<OperationResult<Transaction>> {
        const current = await this.transactionData.retrieveSingle(transaction.id);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.transactionData.update(transaction);
        if (!updated) {
            return Result.userError('Transaction not found or access denied');
        }

        return Result.successUpdated(updated);
    }

    public async deleteTransaction(context: OperationContext, transactionId: string): Promise<OperationResult<void>> {
        const current = await this.transactionData.retrieveSingle(transactionId);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.transactionData.delete(transactionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async getTransactionCashflowByCategory(context: OperationContext, period: CalendarPeriod, asOfDate: string): Promise<OperationResult<CashflowStream[]>> {
        const asOf = asOfDate ? DateTimeUtil.parse(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        const cashflow = await this.transactionData.retrieveCashflowByCategory(context.user.getId(), startDate, endDate);
        return Result.success(cashflow);
    }

    public async exportTransactions(context: OperationContext, accountId?: string): Promise<OperationResult<any>> {
        const transactions = await this.transactionData.exportSearch(context.user.getId(), accountId);

        const account = accountId ? await this.accountData.retrieveSingle(accountId) : undefined;
        const accountName = account?.name?.replace(/[^a-zA-Z0-9]/g, '-');
        const timestamp = DateTimeUtil.nowToISOSafeFilename();
        const fileName = accountName ? `Transactions_${accountName}_${timestamp}.csv` : `Transactions_${timestamp}.csv`;

        if (!transactions || transactions.length === 0) {
            return Result.successFile('text/csv', fileName, 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n');
        }

        const csv = Papa.unparse(transactions, {
            header: true,
            columns: ['date', 'accountName', 'merchant', 'categoryName', 'amount', 'originalStatement', 'notes', 'isHidden']
        });

        const finalCsv = csv.replace(
            /^date,accountName,merchant,categoryName,amount,originalStatement,notes,isHidden/i,
            'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden'
        );

        return Result.successFile('text/csv', fileName, finalCsv);
    }

    public async importTransactions(context: OperationContext, fileBuffer?: Buffer, dryRun: boolean = false, targetAccountId?: string): Promise<OperationResult<TransactionImportResult>> {
        if (!fileBuffer) {
            return Result.userError('No file provided');
        }

        const csvString = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true
        });

        if (parsed.errors.length > 0) {
            return Result.userError('Failed to parse CSV file: ' + parsed.errors[0].message);
        }

        const headers = parsed.meta.fields || [];
        const requiredHeaders = ['Date', 'AccountName', 'Merchant', 'CategoryName', 'Amount', 'OriginalStatement', 'Notes', 'IsHidden'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            return Result.success({
                createdCount: 0,
                failedRowMessages: [],
                isValidToImport: false,
                resultMessage: 'Missing required CSV headers: ' + missingHeaders.join(', ')
            } as TransactionImportResult);
        }

        const userId = context.user.getId();
        const [accountsList, categoriesList] = await Promise.all([
            this.accountData.retrieveAll(userId),
            this.categoryData.retrieveAll(userId)
        ]);
        const accountMap = new Map<string, string>();
        accountsList.forEach(a => accountMap.set(a.name.toLowerCase(), a.id!));

        const categoryMap = new Map<string, string>();
        categoriesList.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id!));

        const failedRowMessages: string[] = [];
        let createdCount = 0;

        let rowIndex = 2;
        for (const row of parsed.data as any[]) {
            const accountName = (row['AccountName'] || '').trim().toLowerCase();
            const categoryName = (row['CategoryName'] || '').trim().toLowerCase();

            let accountId = '';
            if (targetAccountId) {
                accountId = targetAccountId;
            } else {
                accountId = accountMap.get(accountName) || '';
            }

            const categoryId = categoryName ? categoryMap.get(categoryName) : '';

            if (!accountId) {
                failedRowMessages.push(`Row ${rowIndex}: Account name '${row['AccountName']}' not found.`);
                rowIndex++;
                continue;
            }
            if (!categoryId) {
                const error = categoryName
                    ? `Category name '${row['CategoryName']}' not found.`
                    : 'Category is required.';
                failedRowMessages.push(`Row ${rowIndex}: ${error}`);
                rowIndex++;
                continue;
            }

            const transaction = FinanceEntityFactory.createTransaction(userId, {
                accountId: accountId,
                categoryId: categoryId,
                date: DateTimeUtil.toISOString(row['Date'] || DateTimeUtil.now()),
                amount: parseFloat(row['Amount']) || 0,
                merchant: row['Merchant'] || '',
                originalStatement: row['OriginalStatement'] || '',
                notes: row['Notes'] || '',
                isHidden: String(row['IsHidden']).toLowerCase() === 'true',
                isSplit: false,
                splitParentId: ''
            });

            try {
                if (!dryRun) {
                    // TODO: add bulk insert support
                    await this.transactionData.insert(transaction);
                }

                createdCount++;
            }
            catch (err: any) {
                failedRowMessages.push(`Row ${rowIndex}: ${err.message || 'Database error during save'}`);
            }

            rowIndex++;
        }

        // TODO: allow partial import? i.e createdCount > 0
        const canImport = failedRowMessages.length === 0;
        const msgType = dryRun ? 'Dry run: ' : 'Imported: ';

        const result: TransactionImportResult = {
            createdCount: createdCount,
            failedRowMessages: failedRowMessages,
            isValidToImport: canImport,
            resultMessage: `${msgType}Created ${createdCount} transactions.`
        };

        return dryRun ? Result.success(result) : Result.successCreated(result);
    }
}
