import { Router, Request } from 'express';
import multer from 'multer';
import { HistoryTimeframe, OperationStatus, SortDirection } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { ApiHandler } from '@server-core/api-handler';
import { IAppLogger } from '@server-core/logger';
import { DateTimeUtil, ApiUtil } from '@server-core/utility';
import { RequestSchemaValidator } from '@server-core/validation';
import { IFinanceCategoryData } from './../categories';
import { IFinanceTransactionData } from './../transactions';
import { AccountController } from './account-controller';
import { IFinanceAccountData } from './account-data';
import { createAccountSchema, updateAccountSchema } from './account-schema';
import { IFinanceBalanceHistoryData } from './balance-history-data';

const upload = multer({ storage: multer.memoryStorage() });

export function createAccountRouter(logger: IAppLogger, accountData: IFinanceAccountData, balanceHistoryData: IFinanceBalanceHistoryData, categoriesData: IFinanceCategoryData, transactionData: IFinanceTransactionData) {
    const router = Router();
    const controller = new AccountController(logger, accountData, balanceHistoryData, transactionData);
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Account');

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getAccounts', (context) => {
            return controller.getAccounts(context.userId!);
        });
    });

    // TODO: validate params
    router.get('/total-value-history', (req, res) => {
        handler.execute(req, res, 'getTotalValueHistory', (context) => {
            const type = req.query.type as ValueHistoryType;
            const timeframe = req.query.timeframe as HistoryTimeframe;

            const asOfDateStr = req.query.asOfDate as string;
            const asOfDate = asOfDateStr
                ? DateTimeUtil.parse(asOfDateStr)
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
            return controller.updateAccount(context.userId!, account);
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
            const asOfDate = asOfDateStr ? DateTimeUtil.parse(asOfDateStr) : DateTimeUtil.now();

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
            // TODO validate options
            return controller.getAccountTransactions(context.userId!, req.params.id, options);
        });
    });

    router.post('/:id/sync', validator.id(), (req, res) => {
        handler.execute(req, res, 'syncAccount', (context) => {
            return controller.syncAccount(context.userId!, req.params.id);
        });
    });

    router.get('/:id/export-balances', validator.id(), async (req, res) => {
        // TODO needs to use handler
        const userId = ApiUtil.getUserId(req);
        logger.info(userId, 'exportBalanceHistory', 'Starting balance history export');
        try {
            const result = await controller.exportBalanceHistory(userId, req.params.id);

            if (result.status === OperationStatus.Success) {
                const timestamp = new Date().toISOString().substring(0, 10);
                res.setHeader('Content-Type', 'text/csv');
                res.attachment(`Balances_${timestamp}.csv`);
                return res.send(result.data);
            }
            else {
                return ApiUtil.sendResult(res, result);
            }
        }
        catch (error: any) {
            logger.error(userId, 'exportBalanceHistory', `Error: ${error.message || error}`);
            return ApiUtil.internalError(res, error);
        }
    });

    router.post('/:id/import-balances', validator.id(), upload.single('file'), (req, res) => {
        handler.execute(req, res, 'importBalanceHistory', (context) => {
            const dryRun = req.query.dryRun === 'true';
            return controller.importBalanceHistory(context.userId!, req.params.id, req.file?.buffer, dryRun);
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
            }
            catch { /* ignore */ }
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
