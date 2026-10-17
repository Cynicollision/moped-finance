import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import {
    AccountGroupChange,
    BalanceImportResult,
    DailyBalance,
    GetAccountBalanceHistoryOptions,
    TotalValueHistory,
    TotalValueHistoryOptions,
    TransactionSearchOptions
} from '@shared/finance/contracts';
import { Account, Transaction } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { EntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { ITransactionData } from './../transactions';
import { IAccountData } from './account-data';
import { CloseAccountRequest, CreateAccountRequest, UpdateAccountRequest } from './account-schema';
import { BalanceHistoryCsv } from './balance-history-csv';
import { IBalanceHistoryData } from './balance-history-data';

export class AccountController {
    constructor(
        private logger: IAppLogger,
        private accountData: IAccountData,
        private balanceHistoryData: IBalanceHistoryData,
        private transactionData: ITransactionData
    ) {}

    public async getAccount(
        context: OperationContext,
        accountId: string,
        asOfDate?: CalendarDate
    ): Promise<OperationResult<Account>> {
        const account = await this.accountData.retrieveSingle(accountId, asOfDate);
        if (!account) {
            return Result.userErrorNotFound();
        }
        return Result.success(account);
    }

    public async getAccounts(_context: OperationContext, asOfDate?: CalendarDate): Promise<OperationResult<Account[]>> {
        const accounts = await this.accountData.retrieveAll(asOfDate);
        return Result.success(accounts);
    }

    public async createAccount(
        context: OperationContext,
        input: CreateAccountRequest
    ): Promise<OperationResult<Account>> {
        const { balanceEntry, ...fields } = input;
        // Accounts are manual until they're linked to a bank connection (ACCT-1.3, ACCT-4.3).
        // A missing institution fails the insert's foreign key, which OperationHandler reports as a 400.
        const account = EntityFactory.createAccount({ ...fields, isManual: true });

        const created = await this.accountData.insert(account, balanceEntry);
        return Result.successCreated(created);
    }

    public async updateAccount(
        context: OperationContext,
        accountId: string,
        changes: UpdateAccountRequest
    ): Promise<OperationResult<Account>> {
        const current = await this.accountData.retrieveSingle(accountId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const { balanceEntry, ...fields } = changes;
        // An account stays an Asset or a Liability, since its balances are stored signed for that side (ACCT-1.13).
        if (fields.type && AccountTypeUtil.categoryOf(fields.type) !== AccountTypeUtil.categoryOf(current.type)) {
            return Result.userError("An account can't change between an asset and a liability.");
        }
        // A connected account's balance comes from its bank (ACCT-4.4).
        if (balanceEntry && !current.isManual) {
            return Result.userError("A connected account's balance comes from its bank.");
        }
        // A closed account's balance stays 0 until it's reopened (ACCT-6.3).
        if (balanceEntry && current.closedOn) {
            return Result.userError('Reopen this account to set its balance.');
        }

        const updated = await this.accountData.update({ ...current, ...fields }, balanceEntry);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteAccount(context: OperationContext, accountId: string): Promise<OperationResult<void>> {
        const deleted = await this.accountData.delete(accountId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async closeAccount(
        context: OperationContext,
        accountId: string,
        input: CloseAccountRequest
    ): Promise<OperationResult<Account>> {
        const current = await this.accountData.retrieveSingle(accountId);
        if (!current) {
            return Result.userErrorNotFound();
        }
        if (current.closedOn) {
            return Result.userError('This account is already closed.');
        }

        if (!(await this.accountData.close(accountId, input.closedOn))) {
            return Result.userErrorNotFound();
        }
        return Result.successUpdated((await this.accountData.retrieveSingle(accountId))!);
    }

    public async reopenAccount(context: OperationContext, accountId: string): Promise<OperationResult<Account>> {
        if (!(await this.accountData.reopen(accountId))) {
            return Result.userErrorNotFound();
        }
        return Result.successUpdated((await this.accountData.retrieveSingle(accountId))!);
    }

    public async getAccountTransactions(
        context: OperationContext,
        accountId: string,
        options: TransactionSearchOptions
    ): Promise<OperationResult<Transaction[]>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const transactions = await this.transactionData.search(options, accountId);
        return Result.success(transactions);
    }

    public async getAccountBalanceHistory(
        context: OperationContext,
        accountId: string,
        options: GetAccountBalanceHistoryOptions
    ): Promise<OperationResult<DailyBalance[]>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const startDate = CalendarDateUtil.getTimeframeStart(options.timeframe, options.asOfDate);
        const history = await this.balanceHistoryData.retrieveDailyForAccount(accountId, startDate, options.asOfDate);
        return Result.success(history);
    }

    public async getTotalValueHistory(
        context: OperationContext,
        options: TotalValueHistoryOptions
    ): Promise<OperationResult<TotalValueHistory[]>> {
        const startDate = CalendarDateUtil.getTimeframeStart(options.timeframe, options.asOfDate);
        const totalValueHistory = await this.balanceHistoryData.retrieveSumByDate(
            options.type,
            startDate,
            options.asOfDate
        );
        return Result.success(totalValueHistory);
    }

    public async getGroupChanges(
        context: OperationContext,
        options: GetAccountBalanceHistoryOptions
    ): Promise<OperationResult<AccountGroupChange[]>> {
        const startDate = CalendarDateUtil.getTimeframeStart(options.timeframe, options.asOfDate);
        const changes = await this.balanceHistoryData.retrieveGroupChanges(startDate, options.asOfDate);
        return Result.success(changes);
    }

    public async syncAccount(
        _context: OperationContext,
        _accountId: string
    ): Promise<OperationResult<{ message: string }>> {
        // TODO: implement sync/synchronization logic
        return Result.success({ message: 'Sync account logic stub' });
    }

    public async exportBalanceHistory(context: OperationContext, accountId: string): Promise<OperationResult<string>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const accountName = account.name.replace(/[^a-zA-Z0-9]/g, '-');
        const fileName = `Balances_${accountName}_${DateTimeUtil.nowToISOSafeFilename()}.csv`;

        const history = await this.balanceHistoryData.retrieveForExport(accountId);
        return Result.successFile('text/csv', fileName, BalanceHistoryCsv.write(history));
    }

    public async importBalanceHistory(
        context: OperationContext,
        accountId: string,
        file: Buffer | undefined,
        dryRun: boolean
    ): Promise<OperationResult<BalanceImportResult>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const csv = BalanceHistoryCsv.read(file, accountId);
        if (!csv.success) {
            return Result.userError(csv.message);
        }

        const { records, failedRowMessages, startDate, endDate } = csv;
        const isValidToImport = failedRowMessages.length === 0;

        // All or nothing, as for transaction import: a file with any bad row saves nothing.
        if (!isValidToImport) {
            const summary = `Found errors in ${failedRowMessages.length} of ${records.length + failedRowMessages.length} rows.`;
            const result: BalanceImportResult = {
                startDate,
                endDate,
                createdCount: 0,
                failedRowMessages,
                isValidToImport,
                resultMessage: summary
            };
            return dryRun
                ? Result.success(result)
                : Result.userError(`Nothing was imported. ${summary}`, 'INVALID_IMPORT', result);
        }

        if (dryRun) {
            return Result.success({
                startDate,
                endDate,
                createdCount: records.length,
                failedRowMessages,
                isValidToImport,
                resultMessage: `Will replace balances from ${startDate} to ${endDate}.`
            });
        }

        await this.balanceHistoryData.replaceRange(accountId, startDate, endDate, records);
        return Result.successCreated({
            startDate,
            endDate,
            createdCount: records.length,
            failedRowMessages,
            isValidToImport,
            resultMessage: `Imported ${records.length} balance records.`
        });
    }
}
