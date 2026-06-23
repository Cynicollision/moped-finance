import { Router, Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsSortKey } from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server/routing';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoryData } from './../categories/category-data';
import { TransactionController } from './transaction-controller';
import { IFinanceTransactionData } from './transaction-data';
import { createTransactionSchema, updateTransactionSchema } from './transaction-schema';

const domain = 'Transaction';
const upload = multer({ storage: multer.memoryStorage() });

export const transactionSearchQuerySchema = z.object({
    sortKey: z.enum(TransactionsSortKey).optional(),
    sortDirection: z.preprocess((val) => typeof val === 'string' ? val.toUpperCase() : val, z.enum(SortDirection)).optional(),
    offset: z.coerce.number().int().min(0).optional().default(0),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    filters: z.string().optional().transform(v => {
        if (!v) return undefined;
        try { return JSON.parse(v); } catch { return undefined; }
    }),
    includeHidden: z.enum(['true', 'false']).transform(v => v === 'true').optional()
});

export function createTransactionRouter(logger: IAppLogger, accountData: IFinanceAccountData, categoryData: IFinanceCategoryData, transactionsData: IFinanceTransactionData) {
    const router = Router();
    const controller = new TransactionController(logger, accountData, categoryData, transactionsData);
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Transaction');

    // GET / - Search Transactions
    router.get('/', validator.query(transactionSearchQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(req, res, op, (context) => {
            const options = req.query as unknown as TransactionSearchOptions;
            return controller.getTransactions(context, options);
        });
    });

    // POST / - Create Transaction
    router.post('/', validator.body(createTransactionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createTransaction' };
        handler.execute(req, res, op, (context) => {
            const transaction: Transaction = req.body;
            return controller.createTransaction(context, transaction);
        });
    });

    // GET /merchants - Get Unique Merchants
    router.get('/merchants', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactionMerchants' };
        handler.execute(req, res, op, (context) => {
            return controller.getTransactionMerchants(context);
        });
    });

    // GET /cashflow - Get Cashflow by Category
    const cashflowQuerySchema = z.object({
        period: z.enum(CalendarPeriod),
        asOfDate: z.string().optional()
    });

    router.get('/cashflow', validator.query(cashflowQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactionCashflowByCategory' };
        handler.execute(req, res, op, (context) => {
            const { period, asOfDate } = req.query as any;
            return controller.getTransactionCashflowByCategory(context, period, asOfDate);
        });
    });

    // GET /export - Export Transactions
    const exportQuerySchema = z.object({
        accountId: z.string().optional()
    });

    router.get('/export', validator.query(exportQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportTransactions' };
        handler.execute(req, res, op, (context) => {
            const { accountId } = req.query as any;
            return controller.exportTransactions(context, accountId);
        });
    });

    // POST /import - Import Transactions
    const importQuerySchema = z.object({
        dryRun: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        accountId: z.string().optional()
    });

    router.post('/import', upload.single('file'), validator.query(importQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importTransactions' };
        handler.execute(req, res, op, (context) => {
            const { dryRun, accountId } = req.query as any;
            return controller.importTransactions(context, req.file?.buffer, dryRun, accountId);
        });
    });

    // GET /:id - Get Transaction
    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransaction' };
        handler.execute(req, res, op, (context) => {
            return controller.getTransaction(context, req.params.id);
        });
    });

    // PUT /:id - Update Transaction
    router.put('/:id', validator.id(), validator.body(updateTransactionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveTransaction' };
        handler.execute(req, res, op, (context) => {
            const transaction: Transaction = req.body;
            transaction.id = req.params.id; // ensure ID holds
            return controller.saveTransaction(context, transaction);
        });
    });

    // DELETE /:id - Delete Transaction
    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteTransaction' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteTransaction(context, req.params.id);
        });
    });

    return router;
}
