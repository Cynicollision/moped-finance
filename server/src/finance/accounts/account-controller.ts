import { OperationResult } from '@shared/core/contracts';
import { HistoryTimeframe } from '@shared/core/enum';
import { FinanceEntityIdPrefix, ValueHistoryType } from '@shared/finance/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@core/utility';
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
}
