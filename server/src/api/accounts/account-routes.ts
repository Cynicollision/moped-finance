import { Router, Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { HistoryTimeframe, SortDirection } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IFinanceTransactionData, transactionSearchQuerySchema } from './../transactions';
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

    // GET / - Get all accounts
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccounts' };
        handler.execute(req, res, op, (context) => {
            return controller.getAccounts(context);
        });
    });

    // GET /total-value-history - Get Total Value History
    const totalValueHistoryQuerySchema = z.object({
        type: z.enum(ValueHistoryType),
        timeframe: z.enum(HistoryTimeframe).optional().default(HistoryTimeframe.PastThirtyDays),
        asOfDate: z.string().optional()
    });

    router.get('/total-value-history', validator.query(totalValueHistoryQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTotalValueHistory' };
        handler.execute(req, res, op, (context) => {
            const { type, timeframe, asOfDate: asOfDateStr } = req.query as any;

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

    // GET /:id - Get Account
    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.getAccount(context, req.params.id);
        });
    });

    // POST / - Create Account
    router.post('/', validator.body(createAccountSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createAccount' };
        handler.execute(req, res, op, (context) => {
            const account: Account = req.body;
            return controller.createAccount(context, account);
        });
    });

    // PUT /:id - Update Account
    router.put('/:id', validator.id(), validator.body(updateAccountSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveAccount' };
        handler.execute(req, res, op, (context) => {
            const account: Account = req.body;
            account.id = req.params.id;
            return controller.updateAccount(context, account);
        });
    });

    // DELETE /:id - Delete Account
    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteAccount(context, req.params.id);
        });
    });

    // GET /:id/balance-history - Get Balance History
    const balanceHistoryQuerySchema = z.object({
        timeframe: z.enum(HistoryTimeframe).optional().default(HistoryTimeframe.PastThirtyDays),
        asOfDate: z.string().optional()
    });

    router.get('/:id/balance-history', validator.id(), validator.query(balanceHistoryQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getAccountBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            const { timeframe, asOfDate: asOfDateStr } = req.query as any;
            const asOfDate = asOfDateStr ? DateTimeUtil.parse(asOfDateStr) : DateTimeUtil.now();

            const options: GetAccountBalanceHistoryOptions = {
                asOfDate,
                timeframe
            };

            return controller.getAccountBalanceHistory(context, req.params.id, options);
        });
    });

    // GET /:id/transactions - Get Account Transactions
    router.get('/:id/transactions', validator.id(), validator.query(transactionSearchQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(req, res, op, (context) => {
            const options = req.query as unknown as TransactionSearchOptions;
            return controller.getAccountTransactions(context, req.params.id, options);
        });
    });

    // POST /:id/sync - Sync Account
    router.post('/:id/sync', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncAccount' };
        handler.execute(req, res, op, (context) => {
            return controller.syncAccount(context, req.params.id);
        });
    });

    // GET /:id/export-balances - Export Balances
    router.get('/:id/export-balances', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            return controller.exportBalanceHistory(context, req.params.id);
        });
    });

    // POST /:id/import-balances - Import Balances
    const importBalancesQuerySchema = z.object({
        dryRun: z.enum(['true', 'false']).transform(v => v === 'true').optional()
    });

    router.post('/:id/import-balances', validator.id(), upload.single('file'), validator.query(importBalancesQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importBalanceHistory' };
        handler.execute(req, res, op, (context) => {
            const { dryRun } = req.query as any;
            return controller.importBalanceHistory(context, req.params.id, req.file?.buffer, dryRun);
        });
    });

    return router;
}
