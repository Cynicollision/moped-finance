import { Router, Request } from 'express';
import multer from 'multer';
import { HistoryTimeframe, SortDirection } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { OperationDefinition, OperationHandler } from '@server-core/operation-handler';
import { IAppLogger } from '@server-core/logger';
import { DateTimeUtil } from '@server-core/utility';
import { RequestSchemaValidator } from '@server-core/validation';
import { IFinanceTransactionData } from './../transactions';
import { AccountController } from './account-controller';
import { IFinanceAccountData } from './account-data';
import { createAccountSchema, updateAccountSchema } from './account-schema';
import { IFinanceBalanceHistoryData } from './balance-history-data';

const domain = 'Account';
const upload = multer({ storage: multer.memoryStorage() });

export function createAccountRouter(logger: IAppLogger, accountData: IFinanceAccountData, balanceHistoryData: IFinanceBalanceHistoryData, transactionData: IFinanceTransactionData) {
    const router = Router();
    const controller = new AccountController(logger, accountData, balanceHistoryData, transactionData);
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, domain);

    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccounts' };
        handler.execute(req, res, op, (context) => {
            return controller.getAccounts(context);
        });
    });

    // TODO: validate params
    router.get('/total-value-history', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTotalValueHistory' };
        handler.execute(req, res, op, (context) => {
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

            return controller.getTotalValueHistory(context, options);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.getAccount(context, req.params.id);
        });
    });

    router.post('/', validator.body(createAccountSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createAccount' };
        handler.execute(req, res, op, (context) => {
            const account: Account = req.body;
            return controller.createAccount(context, account);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateAccountSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveAccount' };
        handler.execute(req, res, op, (context) => {
            const account: Account = req.body;
            account.id = req.params.id;
            return controller.updateAccount(context, account);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteAccount(context, req.params.id);
        });
    });

    router.get('/:id/balance-history', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccountBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            const timeframe = req.query.timeframe as HistoryTimeframe;
            const asOfDateStr = req.query.asOfDate as string;
            const asOfDate = asOfDateStr ? DateTimeUtil.parse(asOfDateStr) : DateTimeUtil.now();

            const options: GetAccountBalanceHistoryOptions = {
                asOfDate,
                timeframe
            };

            return controller.getAccountBalanceHistory(context, req.params.id, options);
        });
    });

    router.get('/:id/transactions', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(req, res, op, (context) => {
            const options = getTransactionSearchOptions(req);
            // TODO validate options
            return controller.getAccountTransactions(context, req.params.id, options);
        });
    });

    router.post('/:id/sync', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.syncAccount(context, req.params.id);
        });
    });

    router.get('/:id/export-balances', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            return controller.exportBalanceHistory(context, req.params.id);
        });
    });

    router.post('/:id/import-balances', validator.id(), upload.single('file'), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            const dryRun = req.query.dryRun === 'true';
            return controller.importBalanceHistory(context, req.params.id, req.file?.buffer, dryRun);
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
