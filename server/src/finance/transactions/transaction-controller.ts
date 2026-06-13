import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { CalendarPeriod } from '@shared/core/enum';
import { FinanceEntityIdPrefix } from '@shared/finance/enum';
import { TransactionSearchOptions, SpendingStream } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { ResultUtil, DateTimeUtil, EntityIdUtil } from '@server-core/utility';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoriesData } from './../categories/category-data';
import { IFinanceTransactionsData } from './transaction-data';

export class TransactionController {
    private logger: AppLogger;
    private accountData: IFinanceAccountData;
    private categoriesData: IFinanceCategoriesData;
    private transactionsData: IFinanceTransactionsData;

    // TODO: reconsile AccountData vs. AccountsData etc.
    constructor(
        logger: AppLogger,
        accountData: IFinanceAccountData,
        categoriesData: IFinanceCategoriesData,
        transactionsData: IFinanceTransactionsData
    ) {
        this.logger = logger;
        this.accountData = accountData;
        this.categoriesData = categoriesData;
        this.transactionsData = transactionsData;
    }

    public async getTransaction(userId: string, transactionId: string): Promise<OperationResult<Transaction>> {
        const transaction = await this.transactionsData.retrieveSingle(userId, transactionId);
        if (!transaction) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(transaction);
    }

    public async createTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        transaction.id = EntityIdUtil.generate(FinanceEntityIdPrefix.Transaction);
        return ResultUtil.success(await this.transactionsData.insert(userId, transaction));
    }

    public async getTransactions(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        return ResultUtil.success(await this.transactionsData.search(userId, options, accountId));
    }

    public async getTransactionMerchants(userId: string): Promise<OperationResult<string[]>> {
        return ResultUtil.success(await this.transactionsData.retrieveMerchants(userId));
    }

    public async saveTransaction(userId: string, transaction: Transaction): Promise<OperationResult<Transaction>> {
        const updated = await this.transactionsData.update(userId, transaction);
        if (!updated) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteTransaction(userId: string, transactionId: string): Promise<OperationResult<void>> {
        const deleted = await this.transactionsData.delete(userId, transactionId);
        if (!deleted) {
            return ResultUtil.userError('Transaction not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getTransactionSpendingByCategory(userId: string, period: CalendarPeriod, asOfDate: string): Promise<OperationResult<SpendingStream[]>> {
        const asOf = asOfDate ? DateTimeUtil.parse(asOfDate) : DateTimeUtil.now();
        const { startDate, endDate } = DateTimeUtil.getDatesForPeriod(period, asOf);
        return ResultUtil.success(await this.transactionsData.retrieveSpendingByCategory(userId, startDate, endDate));
    }

    public async exportTransactions(userId: string, accountId?: string): Promise<OperationResult<any>> {
        const transactions = await this.transactionsData.exportSearch(userId, accountId);

        if (!transactions || transactions.length === 0) {
            return ResultUtil.success('Id,Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n');
        }

        const csv = Papa.unparse(transactions, {
            header: true,
            columns: ['id', 'date', 'accountName', 'merchant', 'categoryName', 'amount', 'originalStatement', 'notes', 'isHidden']
        });

        const finalCsv = csv.replace(
            /^id,date,accountName,merchant,categoryName,amount,originalStatement,notes,isHidden/i,
            'Id,Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden'
        );

        return ResultUtil.success(finalCsv);
    }

    public async importTransactions(userId: string, fileBuffer?: Buffer, dryRun: boolean = false, targetAccountId?: string): Promise<OperationResult<any>> {
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

        const [accountsList, categoriesList] = await Promise.all([
            this.accountData.retrieveAll(userId),
            this.categoriesData.retrieveAll(userId)
        ]);
        const accountMap = new Map<string, string>();
        accountsList.forEach(a => accountMap.set(a.name.toLowerCase(), a.id!));

        const categoryMap = new Map<string, string>();
        categoriesList.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id!));

        const failedRows: any[] = [];
        let created = 0;
        let updatedCount = 0;

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
                failedRows.push({ row, error: `Account name '${row['AccountName']}' not found and no target account selected.` });
                continue;
            }
            if (!categoryId) {
                const error = categoryName
                    ? `Category name '${row['CategoryName']}' not found.`
                    : 'Category is required.';
                failedRows.push({ row, error });
                continue;
            }

            const transaction: Transaction = {
                id: row['Id'] ? String(row['Id']).trim() : EntityIdUtil.generate(FinanceEntityIdPrefix.Transaction),
                createdAt: DateTimeUtil.now(),
                updatedAt: DateTimeUtil.now(),
                accountId: accountId,
                categoryId: categoryId || '',
                date: DateTimeUtil.toISOString(row['Date'] || DateTimeUtil.now()),
                amount: parseFloat(row['Amount']) || 0,
                merchant: row['Merchant'] || '',
                originalStatement: row['OriginalStatement'] || '',
                notes: row['Notes'] || '',
                isHidden: String(row['IsHidden']).toLowerCase() === 'true',
                isSplit: false,
                splitParentId: ''
            };

            try {
                if (!dryRun) {
                    if (row['Id'] && String(row['Id']).trim() !== '') {
                        // Update
                        const updated = await this.transactionsData.update(userId, transaction);
                        if (updated) {
                            updatedCount++;
                        }
                        else {
                            failedRows.push({ row, error: 'Transaction ID not found for update or access denied.' });
                        }
                    }
                    else {
                        // Insert
                        await this.transactionsData.insert(userId, transaction);
                        created++;
                    }
                } else {
                    if (row['Id'] && String(row['Id']).trim() !== '') {
                        updatedCount++;
                    } else {
                        created++;
                    }
                }
            }
            catch (err: any) {
                failedRows.push({ row, error: err.message || 'Database error during save' });
            }
        }

        return ResultUtil.success({ created, updated: updatedCount, failed: failedRows });
    }
}
