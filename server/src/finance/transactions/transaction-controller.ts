import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { CalendarPeriod } from '@shared/core/enum';
import { CashflowStream, TransactionImportResult, TransactionSearchOptions } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { ResultUtil, DateTimeUtil } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
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

    public async getTransaction(userId: string, transactionId: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactionData.retrieveSingle(transactionId);
        if (!transaction) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(transaction);
    }

    public async createTransaction(userId: string, newTransaction: NewEntity<Transaction>): Promise<OperationResult<Transaction>> {
        const transaction = FinanceEntityFactory.createTransaction(newTransaction.accountId!, newTransaction);
        return ResultUtil.success(await this.transactionData.insert(transaction));
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        return ResultUtil.success(await this.transactionData.search(userId, options, accountId));
    }

    public async getTransactionMerchants(userId: string): Promise<OperationResult<string[]>> {
        return ResultUtil.success(await this.transactionData.retrieveMerchants(userId));
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        const updated = await this.transactionData.update(transaction);
        if (!updated) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteTransaction(userId: string, transactionId: string): Promise<OperationResult<void>> {
        const deleted = await this.transactionData.delete(transactionId);
        if (!deleted) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getTransactionCashflowByCategory(userId: string, period: CalendarPeriod, asOfDate: string): Promise<OperationResult<CashflowStream[]>> {
        const asOf = asOfDate ? DateTimeUtil.parse(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return ResultUtil.success(await this.transactionData.retrieveCashflowByCategory(userId, startDate, endDate));
    }

    public async exportTransactions(userId: string, accountId?: string): Promise<OperationResult<any>> {
        const transactions = await this.transactionData.exportSearch(userId, accountId);

        if (!transactions || transactions.length === 0) {
            return ResultUtil.success('Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n');
        }

        const csv = Papa.unparse(transactions, {
            header: true,
            columns: ['date', 'accountName', 'merchant', 'categoryName', 'amount', 'originalStatement', 'notes', 'isHidden']
        });

        const finalCsv = csv.replace(
            /^date,accountName,merchant,categoryName,amount,originalStatement,notes,isHidden/i,
            'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden'
        );

        return ResultUtil.success(finalCsv);
    }

    public async importTransactions(userId: string, fileBuffer?: Buffer, dryRun: boolean = false, targetAccountId?: string): Promise<OperationResult<TransactionImportResult>> {
        if (!fileBuffer) {
            return ResultUtil.userError('No file provided');
        }

        const csvString = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true
        });

        if (parsed.errors.length > 0) {
            return ResultUtil.userError('Failed to parse CSV file: ' + parsed.errors[0].message);
        }

        const headers = parsed.meta.fields || [];
        const requiredHeaders = ['Date', 'AccountName', 'Merchant', 'CategoryName', 'Amount', 'OriginalStatement', 'Notes', 'IsHidden'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            return ResultUtil.success({
                createdCount: 0,
                failedRowMessages: [],
                isValidToImport: false,
                resultMessage: 'Missing required CSV headers: ' + missingHeaders.join(', ')
            } as TransactionImportResult);
        }

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
                failedRowMessages.push(`Row ${rowIndex}: Account name '${row['AccountName']}' not found and no target account selected.`);
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

            const transaction = FinanceEntityFactory.createTransaction(accountId, {
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

        return ResultUtil.success({
            createdCount: createdCount,
            failedRowMessages: failedRowMessages,
            isValidToImport: canImport,
            resultMessage: `${msgType}Created ${createdCount} transactions.`
        } as TransactionImportResult);
    }
}
