import { Router, Request } from 'express';
import { SortDirection } from '@shared/common/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { HistoryTimeframe } from '@shared/common/enum';
import { TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { DateTimeUtil } from '@core/utility';
import { RequestSchemaValidator } from '@core/validation';
import { AccountController } from './../controllers/account-controller';
import { TransactionController } from './../controllers/transaction-controller';
import { IFinanceAccountData } from './../data/account-data';
import { IFinanceBalanceHistoryData } from './../data/balance-history-data';
import { IFinanceTransactionsData } from './../data/transactions-data';

import { createAccountSchema, updateAccountSchema } from './../schema/account-schema';

export function createAccountRouter(
    accountData: IFinanceAccountData,
    balanceHistoryData: IFinanceBalanceHistoryData,
    transactionsData: IFinanceTransactionsData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new AccountController(logger, accountData, balanceHistoryData);
    const transactionController = new TransactionController(logger, transactionsData);
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Account');

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getAccounts', (context) => {
            return controller.getAccounts(context.userId!);
        });
    });

    router.get('/total-value-history', (req, res) => {
        handler.execute(req, res, 'getTotalValueHistory', (context) => {
            const type = req.query.type as ValueHistoryType;
            const timeframe = req.query.timeframe as HistoryTimeframe;

            const asOfDateStr = req.query.asOfDate as string;
            const asOfDate = asOfDateStr
                ? new Date(asOfDateStr)
                : DateTimeUtil.now();

            const options: TotalValueHistoryOptions = {
                asOfDate,
                type,
                timeframe
            };

            return controller.getTotalValueHistory(context.userId!, options);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'getAccount', (context) => {
            return controller.getAccount(context.userId!, req.params.id);
        });
    });

    router.post('/', validator.body(createAccountSchema), (req, res) => {
        handler.execute(req, res, 'createAccount', (context) => {
            const account: Account = req.body;
            return controller.createAccount(context.userId!, account);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateAccountSchema), (req, res) => {
        handler.execute(req, res, 'saveAccount', (context) => {
            const account: Account = req.body;
            account.id = req.params.id;
            return controller.saveAccount(context.userId!, account);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'deleteAccount', (context) => {
            return controller.deleteAccount(context.userId!, req.params.id);
        });
    });

    router.get('/:id/balance-history', validator.id(), (req, res) => {
        handler.execute(req, res, 'getAccountBalanceHistory', (context) => {
            const timeframe = req.query.timeframe as HistoryTimeframe;
            const asOfDateStr = req.query.asOfDate as string;
            const asOfDate = asOfDateStr ? new Date(asOfDateStr) : DateTimeUtil.now();

            const options: GetAccountBalanceHistoryOptions = {
                asOfDate,
                timeframe
            };

            return controller.getAccountBalanceHistory(context.userId!, req.params.id, options);
        });
    });

    router.get('/:id/transactions', validator.id(), (req, res) => {
        handler.execute(req, res, 'getTransactions', (context) => {
            const options = getTransactionSearchOptions(req);
            return transactionController.getTransactions(context.userId!, options, req.params.id);
        });
    });

    function getTransactionSearchOptions(req: Request): TransactionSearchOptions {
        const sortKey = req.query.sortKey as TransactionsSortKey;
        const sortDirection = req.query.sortDirection as SortDirection;
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const includeHidden = req.query.includeHidden === 'true';

        const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
        const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;

        let filters;
        if (typeof req.query.filters === 'string') {
            try {
                filters = JSON.parse(req.query.filters);
            } catch { /* ignore */ }
        }

        return {
            sortKey: sortKey,
            sortDirection: sortDirection,
            offset: offset,
            limit: limit,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            filters,
            includeHidden
        };
    }

    return router;
}
