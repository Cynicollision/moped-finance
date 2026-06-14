import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { HistoryTimeframe } from '@shared/core/enum';
import { FinanceEntityIdPrefix, ValueHistoryType } from '@shared/finance/enum';
import { BalanceImportResult, GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@server-core/utility';
import { IFinanceTransactionData } from './../transactions';
import { IFinanceAccountData } from './account-data';
import { IFinanceBalanceHistoryData } from './balance-history-data';

export class AccountController {
    constructor(
        private logger: AppLogger,
        private accountData: IFinanceAccountData,
        private balanceHistoryData: IFinanceBalanceHistoryData,
        private transactionData: IFinanceTransactionData
    ) {
    }

    public async getAccount(userId: string, accountId: string): Promise<OperationResult<Account>> {
        const account = await this.accountData.retrieveSingle(userId, accountId);
        if (!account) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success(account);
    }

    public async getAccounts(userId: string): Promise<OperationResult<Account[]>> {
        return ResultUtil.success(await this.accountData.retrieveAll(userId));
    }

    public async createAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        account.id = EntityIdUtil.generate(FinanceEntityIdPrefix.Account);
        account.userId = userId;

        return ResultUtil.success(await this.accountData.create(userId, account));
    }

    public async saveAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        const updated = await this.accountData.update(userId, account);
        if (!updated) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteAccount(userId: string, accountId: string): Promise<OperationResult<void>> {
        const deleted = await this.accountData.delete(userId, accountId);
        if (!deleted) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getAccountTransactions(userId: string, accountId: string, options: TransactionSearchOptions): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        return ResultUtil.success(await this.transactionData.search(userId, options, accountId));
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<OperationResult<BalanceHistory[]>> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.balanceHistoryData.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString()));
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<OperationResult<TotalValueHistory[]>> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;
        // TODO: validate options

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.balanceHistoryData.retrieveSumByDate(userId, options.type, startDate, options.asOfDate));
    }

    public async syncAccount(userId: string, accountId: string): Promise<OperationResult<any>> {
        // TODO: implement sync/synchronization logic
        return ResultUtil.success({ message: 'Sync account logic stub' });
    }

    public async exportBalanceHistory(userId: string, accountId: string): Promise<OperationResult<any>> {
        const history = await this.balanceHistoryData.exportSearch(userId, accountId);

        if (!history || history.length === 0) {
            return ResultUtil.success('Date,AccountName,Balance\n');
        }

        const csv = Papa.unparse(history, {
            header: true,
            columns: ['Date', 'AccountName', 'Balance']
        });

        return ResultUtil.success(csv);
    }

    public async importBalanceHistory(userId: string, accountId: string, fileBuffer: Buffer | undefined, dryRun: boolean): Promise<OperationResult<BalanceImportResult>> {
        if (!fileBuffer) {
            return ResultUtil.userError('No file provided');
        }

        const account = await this.accountData.retrieveSingle(userId, accountId);
        if (!account) {
            return ResultUtil.userError('Account not found');
        }

        const csvString = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true
        });

        // TODO: use, move method to /balance-import
        let importResult: BalanceImportResult = {};

        if (parsed.errors.length > 0) {
            return ResultUtil.success({
                startDate: '',
                endDate: '',
                createdCount: 0,
                failedRowMessages: [],
                isValidToImport: false,
                resultMessage: 'Failed to parse CSV file: ' + parsed.errors[0].message
            });
        }

        const headers = parsed.meta.fields || [];
        const requiredHeaders = ['Date', 'Balance'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            return ResultUtil.success({
                startDate: '',
                endDate: '',
                createdCount: 0,
                failedRowMessages: [],
                isValidToImport: false,
                resultMessage: 'Missing required CSV headers: ' + missingHeaders.join(', ')
            });
        }

        const records = parsed.data as any[];
        if (records.length === 0) {
            return ResultUtil.success({
                startDate: '',
                endDate: '',
                createdCount: 0,
                failedRowMessages: [],
                isValidToImport: false,
                resultMessage: 'CSV is empty'
            });
        }

        let minDate = '';
        let maxDate = '';

        const validRows: BalanceHistory[] = [];
        const failedRowMessages: string[] = [];

        let rowIndex = 2;
        for (const row of records) {
            const dateStr = (row['Date'] || '').trim();
            const balanceStr = (row['Balance'] || '').trim();

            if (!dateStr || !balanceStr) {
                failedRowMessages.push(`Row ${rowIndex}: Date and Balance are required`);
                rowIndex++;
                continue;
            }

            const parsedDate = DateTimeUtil.parse(dateStr);
            const isoDate = DateTimeUtil.toDateString(dateStr);

            if (!minDate || isoDate < minDate) minDate = isoDate;
            if (!maxDate || isoDate > maxDate) maxDate = isoDate;

            validRows.push({
                id: EntityIdUtil.generate(FinanceEntityIdPrefix.BalanceHistory),
                createdAt: DateTimeUtil.now(),
                updatedAt: DateTimeUtil.now(),
                accountId: accountId,
                date: parsedDate,
                balance: parseFloat(balanceStr) || 0
            });
            rowIndex++;
        }

        if (dryRun) {
            return ResultUtil.success({
                startDate: minDate,
                endDate: maxDate,
                createdCount: validRows.length,
                failedRowMessages: failedRowMessages,
                isValidToImport: failedRowMessages.length === 0, // TODO: allow partial import?
                resultMessage: `Dry run: Will replace dates ${minDate} to ${maxDate}`
            });
        }

        if (validRows.length > 0) {
            try {
                await this.balanceHistoryData.deleteRange(userId, accountId, minDate, maxDate);
                await this.balanceHistoryData.insertBulk(userId, validRows);
            }
            catch (err: any) {
                return ResultUtil.userError('Database error during import: ' + err.message);
            }
        }

        return ResultUtil.success({
            startDate: minDate,
            endDate: maxDate,
            createdCount: validRows.length,
            failedRowMessages: failedRowMessages,
            isValidToImport: failedRowMessages.length === 0, // TODO: allow partial import?
            resultMessage: `Imported ${validRows.length} balance records.`
        });
    }
}
