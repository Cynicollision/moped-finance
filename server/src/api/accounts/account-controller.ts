import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { HistoryTimeframe } from '@shared/core/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { BalanceImportResult, GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction } from '@shared/finance/types';
import { FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IFinanceTransactionData } from './../transactions';
import { IFinanceAccountData } from './account-data';
import { IFinanceBalanceHistoryData } from './balance-history-data';

export class AccountController {
    constructor(
        private logger: IAppLogger,
        private accountData: IFinanceAccountData,
        private balanceHistoryData: IFinanceBalanceHistoryData,
        private transactionData: IFinanceTransactionData
    ) {
    }

    public async getAccount(context: OperationContext, accountId: string): Promise<OperationResult<Account>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account || !context.user.canAccess(account)) {
            return Result.userErrorNotFound();
        }
        return Result.success(account);
    }

    public async getAccounts(context: OperationContext): Promise<OperationResult<Account[]>> {
        const accounts = await this.accountData.retrieveAll(context.user.getId());
        return Result.success(accounts);
    }

    public async createAccount(context: OperationContext, newAccount: NewEntity<Account>): Promise<OperationResult<Account>> {
        const account = FinanceEntityFactory.createAccount(context.user.getId(), newAccount);
        const created = await this.accountData.insert(account);
        return Result.successCreated(created);
    }

    public async updateAccount(context: OperationContext, account: Account): Promise<OperationResult<Account>> {
        const current = await this.accountData.retrieveSingle(account.id);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.accountData.update(account);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteAccount(context: OperationContext, accountId: string): Promise<OperationResult<void>> {
        const current = await this.accountData.retrieveSingle(accountId);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.accountData.delete(accountId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async getAccountTransactions(context: OperationContext, accountId: string, options: TransactionSearchOptions): Promise<OperationResult<Transaction[]>> {
        // TODO: validate options
        const tranactions = await this.transactionData.search(context.user.getId(), options, accountId);
        return Result.success(tranactions);
    }

    public async getAccountBalanceHistory(context: OperationContext, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<OperationResult<BalanceHistory[]>> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const account = await this.accountData.retrieveSingle(accountId);

        if (!account || !context.user.canAccess(account)) {
            return Result.userErrorNotFound();
        }

        const history = await this.balanceHistoryData.retrieveForAccount(accountId, startDate.toISOString(), options.asOfDate.toISOString());
        return Result.success(history);
    }

    public async getTotalValueHistory(context: OperationContext, options: TotalValueHistoryOptions): Promise<OperationResult<TotalValueHistory[]>> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;
        // TODO: validate options

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const totalValueHistory = await this.balanceHistoryData.retrieveSumByDate(context.user.getId(), options.type, startDate, options.asOfDate);

        return Result.success(totalValueHistory);
    }

    public async syncAccount(context: OperationContext, accountId: string): Promise<OperationResult<any>> {
        // TODO: implement sync/synchronization logic
        return Result.success({ message: 'Sync account logic stub' });
    }

    public async exportBalanceHistory(context: OperationContext, accountId: string): Promise<OperationResult<string>> {
        const account = await this.accountData.retrieveSingle(accountId);

        if (!account || !context.user.canAccess(account)) {
            return Result.userErrorNotFound();
        }

        const accountName = account.name?.replace(/[^a-zA-Z0-9]/g, '-') || '';
        const timestamp = DateTimeUtil.nowToISOSafeFilename();
        const fileName = `Balances_${accountName}_${timestamp}.csv`;

        const history = await this.balanceHistoryData.retrieveForExport(accountId);

        if (!history || history.length === 0) {
            return Result.successFile('text/csv', fileName, 'Date,AccountName,Balance\n');
        }

        const csv = Papa.unparse(history, {
            header: true,
            columns: ['date', 'accountName', 'balance']
        });

        const finalCsv = csv.replace(
            /^date,accountName,balance/i,
            'Date,AccountName,Balance'
        );

        return Result.successFile('text/csv', fileName, finalCsv);
    }

    public async importBalanceHistory(context: OperationContext, accountId: string, fileBuffer: Buffer | undefined, dryRun: boolean): Promise<OperationResult<BalanceImportResult>> {
        if (!fileBuffer) {
            return Result.userError('No file provided');
        }

        const account = await this.accountData.retrieveSingle(accountId);
        if (!account || !context.user.canAccess(account)) {
            return Result.userErrorNotFound();
        }

        const csvString = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true
        });

        // TODO: bad request
        if (parsed.errors.length > 0) {
            return Result.success({
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
            return Result.success({
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
            return Result.success({
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

            validRows.push(FinanceEntityFactory.createBalanceHistory(context.user.getId(), {
                accountId: accountId,
                date: parsedDate,
                balance: parseFloat(balanceStr) || 0
            }));
            rowIndex++;
        }

        if (dryRun) {
            return Result.success({
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
                await this.balanceHistoryData.deleteRange(accountId, minDate, maxDate);
                await this.balanceHistoryData.insertBulk(validRows);
            }
            catch (err: any) {
                return Result.userError('Database error during import: ' + err.message);
            }
        }

        return Result.success({
            startDate: minDate,
            endDate: maxDate,
            createdCount: validRows.length,
            failedRowMessages: failedRowMessages,
            isValidToImport: failedRowMessages.length === 0, // TODO: allow partial import?
            resultMessage: `Imported ${validRows.length} balance records.`
        });
    }
}
