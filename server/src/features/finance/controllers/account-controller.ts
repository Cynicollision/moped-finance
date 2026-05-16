import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions } from '@shared/finance/contracts';
import { HistoryTimeframe } from '@shared/common/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { Account, BalanceHistory } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceAccountData } from './../data/account-data';
import { IFinanceBalanceHistoryData } from './../data/balance-history-data';

export class AccountController {
    constructor(
        private logger: AppLogger,
        private accounts: IFinanceAccountData,
        private balanceHistory: IFinanceBalanceHistoryData
    ) {
    }

    public async getAccount(userId: string, id: string): Promise<OperationResult<Account>> {
        const account = await this.accounts.retrieveSingle(userId, id);
        if (!account) {
            return ResultUtil.userError('Account not found or access denied');
        }
        return ResultUtil.success(account);
    }

    public async getAccounts(userId: string): Promise<OperationResult<Account[]>> {
        return ResultUtil.success(await this.accounts.retrieveAll(userId));
    }

    public async createAccount(userId: string, account: Account): Promise<OperationResult<Account>> {
        account.id = EntityIdUtil.generate(EntityIdPrefix.FinanceAccount);
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

    public async deleteAccount(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.accounts.delete(userId, id);
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
}
