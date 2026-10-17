import { Router } from 'express';
import { z } from 'zod';
import { HistoryTimeframe } from '@shared/core/enum';
import { ValueHistoryType } from '@shared/finance/enum';
import { IAppLogger } from '@server/logging';
import {
    asOfDateQuerySchema,
    idParamsSchema,
    OperationDefinition,
    OperationHandler,
    QueryField,
    singleFileUpload
} from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { ITransactionData, transactionSearchQuerySchema } from './../transactions';
import { AccountController } from './account-controller';
import { IAccountData } from './account-data';
import { closeAccountSchema, createAccountSchema, updateAccountSchema } from './account-schema';
import { IBalanceHistoryData } from './balance-history-data';

const domain = 'Account';

export function createAccountRouter(
    logger: IAppLogger,
    accountData: IAccountData,
    balanceHistoryData: IBalanceHistoryData,
    transactionData: ITransactionData
) {
    const router = Router();
    const controller = new AccountController(logger, accountData, balanceHistoryData, transactionData);
    const handler = new OperationHandler(logger);

    // GET / - Get all accounts
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccounts' };
        handler.execute(req, res, op, { query: asOfDateQuerySchema }, (context, { query }) => {
            return controller.getAccounts(context, query.asOfDate);
        });
    });

    // GET /total-value-history - Get Total Value History
    const totalValueHistoryQuerySchema = z.object({
        type: z.enum(ValueHistoryType),
        timeframe: z.enum(HistoryTimeframe).optional().default(HistoryTimeframe.PastThirtyDays),
        asOfDate: QueryField.date().optional()
    });

    router.get('/total-value-history', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTotalValueHistory' };
        handler.execute(req, res, op, { query: totalValueHistoryQuerySchema }, (context, { query }) => {
            return controller.getTotalValueHistory(context, {
                type: query.type,
                timeframe: query.timeframe,
                asOfDate: query.asOfDate ?? DateTimeUtil.today()
            });
        });
    });

    // GET /group-changes - Each account group's change over the timeframe (DASH-2.2)
    const groupChangesQuerySchema = z.object({
        timeframe: z.enum(HistoryTimeframe).optional().default(HistoryTimeframe.PastThirtyDays),
        asOfDate: QueryField.date().optional()
    });

    router.get('/group-changes', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroupChanges' };
        handler.execute(req, res, op, { query: groupChangesQuerySchema }, (context, { query }) => {
            return controller.getGroupChanges(context, {
                timeframe: query.timeframe,
                asOfDate: query.asOfDate ?? DateTimeUtil.today()
            });
        });
    });

    // GET /:id - Get Account
    router.get('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccount' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: asOfDateQuerySchema },
            (context, { params, query }) => {
                return controller.getAccount(context, params.id, query.asOfDate);
            }
        );
    });

    // POST / - Create Account
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createAccount' };
        handler.execute(req, res, op, { body: createAccountSchema }, (context, { body }) => {
            return controller.createAccount(context, body);
        });
    });

    // PUT /:id - Update Account
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveAccount' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateAccountSchema },
            (context, { params, body }) => {
                return controller.updateAccount(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Account
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteAccount' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteAccount(context, params.id);
        });
    });

    // POST /:id/close - Close Account (ACCT-6.1)
    router.post('/:id/close', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'closeAccount' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: closeAccountSchema },
            (context, { params, body }) => {
                return controller.closeAccount(context, params.id, body);
            }
        );
    });

    // POST /:id/reopen - Reopen Account (ACCT-6.3)
    router.post('/:id/reopen', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'reopenAccount' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.reopenAccount(context, params.id);
        });
    });

    // GET /:id/balance-history - Get Balance History
    const balanceHistoryQuerySchema = z.object({
        timeframe: z.enum(HistoryTimeframe).optional().default(HistoryTimeframe.PastThirtyDays),
        asOfDate: QueryField.date().optional()
    });

    router.get('/:id/balance-history', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccountBalanceHistory' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: balanceHistoryQuerySchema },
            (context, { params, query }) => {
                return controller.getAccountBalanceHistory(context, params.id, {
                    timeframe: query.timeframe,
                    asOfDate: query.asOfDate ?? DateTimeUtil.today()
                });
            }
        );
    });

    // GET /:id/transactions - Get Account Transactions
    router.get('/:id/transactions', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: transactionSearchQuerySchema },
            (context, { params, query }) => {
                return controller.getAccountTransactions(context, params.id, query);
            }
        );
    });

    // POST /:id/sync - Sync Account
    router.post('/:id/sync', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncAccount' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.syncAccount(context, params.id);
        });
    });

    // GET /:id/export-balances - Export Balances
    router.get('/:id/export-balances', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportBalanceHistory' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.exportBalanceHistory(context, params.id);
        });
    });

    // POST /:id/import-balances - Import Balances
    const importBalancesQuerySchema = z.object({
        dryRun: QueryField.boolean().optional().default(false)
    });

    router.post('/:id/import-balances', singleFileUpload, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importBalanceHistory' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: importBalancesQuerySchema },
            (context, { params, query }) => {
                return controller.importBalanceHistory(context, params.id, req.file?.buffer, query.dryRun);
            }
        );
    });

    return router;
}
