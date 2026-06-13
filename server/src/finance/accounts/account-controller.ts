import Papa from 'papaparse';
import { OperationResult } from '@shared/core/contracts';
import { HistoryTimeframe } from '@shared/core/enum';
import { FinanceEntityIdPrefix, ValueHistoryType } from '@shared/finance/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@server-core/utility';
import { IFinanceAccountData } from './account-data';
import { IFinanceBalanceHistoryData } from './balance-history-data';

export class AccountController {
    private readonly logger: AppLogger;
    private readonly accounts: IFinanceAccountData;
    private readonly balanceHistory: IFinanceBalanceHistoryData;

    constructor(logger: AppLogger, accounts: IFinanceAccountData, balanceHistory: IFinanceBalanceHistoryData) {
        this.logger = logger;
        this.accounts = accounts;
        this.balanceHistory = balanceHistory;
    }

    public async getAccount(userId: string, accountId: string): Promise<OperationResult<Account>> {
        const account = await this.accounts.retrieveSingle(userId, accountId);
        if (!account) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success(account);
    }

    public async getAccounts(userId: string): Promise<OperationResult<Account[]>> {
        return ResultUtil.success(await this.accounts.retrieveAll(userId));
    }

    public async createAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        account.id = EntityIdUtil.generate(FinanceEntityIdPrefix.Account);
        account.userId = userId;

        return ResultUtil.success(await this.accounts.create(userId, account));
    }

    public async saveAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        const updated = await this.accounts.update(userId, account);
        if (!updated) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteAccount(userId: string, accountId: string): Promise<OperationResult<void>> {
        const deleted = await this.accounts.delete(userId, accountId);
        if (!deleted) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success();
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<OperationResult<BalanceHistory[]>> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.balanceHistory.retrieveForAccount(userId, accountId, startDate.toISOString(), options.asOfDate.toISOString()));
    }

    public async getTotalValueHistory(userId: string, options: TotalValueHistoryOptions): Promise<OperationResult<TotalValueHistory[]>> {
        options.type = options.type || ValueHistoryType.NetWorth;
        options.timeframe = options.timeframe || HistoryTimeframe.PastThirtyDays;
        // TODO: validate options

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        return ResultUtil.success(await this.balanceHistory.retrieveSumByDate(userId, options.type, startDate, options.asOfDate));
    }

    public async syncAccount(userId: string, accountId: string): Promise<OperationResult<any>> {
        // TODO: implement sync/synchronization logic
        return ResultUtil.success({ message: 'Sync account logic stub' });
    }

    public async exportBalanceHistory(userId: string, accountId: string): Promise<OperationResult<any>> {
        const history = await this.balanceHistory.exportSearch(userId, accountId);

        if (!history || history.length === 0) {
            return ResultUtil.success('Date,AccountName,Balance\n');
        }

        const csv = Papa.unparse(history, {
            header: true,
            columns: ['Date', 'AccountName', 'Balance']
        });

        return ResultUtil.success(csv);
    }

    public async importBalanceHistory(userId: string, accountId: string, fileBuffer: Buffer | undefined, dryRun: boolean): Promise<OperationResult<any>> {
        if (!fileBuffer) {
            return ResultUtil.userError('No file provided');
        }

        const account = await this.accounts.retrieveSingle(userId, accountId);
        if (!account) {
            return ResultUtil.userError('Account not found');
        }

        const csvString = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true
        });

        if (parsed.errors.length > 0) {
            return ResultUtil.userError('Failed to parse CSV file: ' + parsed.errors[0].message);
        }

        const records = parsed.data as any[];
        if (records.length === 0) {
            return ResultUtil.userError('CSV is empty');
        }

        let minDate = '';
        let maxDate = '';

        const validRows: BalanceHistory[] = [];
        const failedRows: any[] = [];

        for (const row of records) {
            const dateStr = (row['Date'] || '').trim();
            const balanceStr = (row['Balance'] || '').trim();

            if (!dateStr || !balanceStr) {
                failedRows.push({ row, error: 'Date and Balance are required' });
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
        }

        if (dryRun) {
            return ResultUtil.success({
                startDate: minDate,
                endDate: maxDate,
                created: validRows.length,
                updated: 0,
                failed: failedRows,
                message: `Will replace dates ${minDate} to ${maxDate}`
            });
        }

        if (validRows.length > 0) {
            try {
                await this.balanceHistory.deleteRange(userId, accountId, minDate, maxDate);
                await this.balanceHistory.insertBulk(userId, validRows);
            }
            catch (err: any) {
                return ResultUtil.userError('Database error during import: ' + err.message);
            }
        }

        return ResultUtil.success({ 
            created: validRows.length,
            updated: 0,
            failed: failedRows 
        });
    }
}
