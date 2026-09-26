import { BalanceImportResult, GetAccountBalanceHistoryOptions, TotalValueHistory, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction } from '@shared/finance/types';
import { FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IFinanceTransactionData } from './../transactions';
import { IFinanceAccountData } from './account-data';
import { CreateAccountRequest, UpdateAccountRequest } from './account-schema';
import { BalanceHistoryCsv } from './balance-history-csv';
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
        if (!account) {
            return Result.userErrorNotFound();
        }
        return Result.success(account);
    }

    public async getAccounts(context: OperationContext): Promise<OperationResult<Account[]>> {
        const accounts = await this.accountData.retrieveAll();
        return Result.success(accounts);
    }

    public async createAccount(context: OperationContext, input: CreateAccountRequest): Promise<OperationResult<Account>> {
        // A missing institution fails the insert's foreign key, which OperationHandler reports as a 400.
        const account = FinanceEntityFactory.createAccount({
            ...input,
            type: input.type ?? null
        });

        const created = await this.accountData.insert(account);
        return Result.successCreated(created);
    }

    public async updateAccount(context: OperationContext, accountId: string, changes: UpdateAccountRequest): Promise<OperationResult<Account>> {
        const current = await this.accountData.retrieveSingle(accountId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const updated = await this.accountData.update({ ...current, ...changes });
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

    public async getAccountTransactions(context: OperationContext, accountId: string, options: TransactionSearchOptions): Promise<OperationResult<Transaction[]>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const transactions = await this.transactionData.search(options, accountId);
        return Result.success(transactions);
    }

    public async getAccountBalanceHistory(context: OperationContext, accountId: string, options: GetAccountBalanceHistoryOptions): Promise<OperationResult<BalanceHistory[]>> {
        const account = await this.accountData.retrieveSingle(accountId);
        if (!account) {
            return Result.userErrorNotFound();
        }

        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const history = await this.balanceHistoryData.retrieveForAccount(accountId, startDate.toISOString(), options.asOfDate.toISOString());
        return Result.success(history);
    }

    public async getTotalValueHistory(context: OperationContext, options: TotalValueHistoryOptions): Promise<OperationResult<TotalValueHistory[]>> {
        const startDate = DateTimeUtil.getStartDateForTimeframe(options.timeframe, options.asOfDate);
        const totalValueHistory = await this.balanceHistoryData.retrieveSumByDate(options.type, startDate, options.asOfDate);
        return Result.success(totalValueHistory);
    }

    public async syncAccount(context: OperationContext, accountId: string): Promise<OperationResult<any>> {
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

    public async importBalanceHistory(context: OperationContext, accountId: string, file: Buffer | undefined, dryRun: boolean): Promise<OperationResult<BalanceImportResult>> {
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
            const result: BalanceImportResult = { startDate, endDate, createdCount: 0, failedRowMessages, isValidToImport, resultMessage: summary };
            return dryRun
                ? Result.success(result)
                : Result.userError(`Nothing was imported. ${summary}`, 'INVALID_IMPORT', result);
        }

        if (dryRun) {
            return Result.success({ startDate, endDate, createdCount: records.length, failedRowMessages, isValidToImport, resultMessage: `Will replace balances from ${startDate} to ${endDate}.` });
        }

        await this.balanceHistoryData.replaceRange(accountId, startDate, endDate, records);
        return Result.successCreated({ startDate, endDate, createdCount: records.length, failedRowMessages, isValidToImport, resultMessage: `Imported ${records.length} balance records.` });
    }
}
