import { Router } from 'express';
import { z } from 'zod';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { IAppLogger } from '@server/logging';
import { idParamsSchema, OperationDefinition, OperationHandler, QueryField, singleFileUpload } from '@server/routing';
import { IFinanceAccountData } from './../accounts/account-data';
import { IFinanceCategoryData } from './../categories/category-data';
import { TransactionController } from './transaction-controller';
import { IFinanceTransactionData } from './transaction-data';
import { createTransactionSchema, updateTransactionSchema } from './transaction-schema';

const domain = 'Transaction';

const searchFiltersSchema = z.array(
    z.object({
        key: z.enum(TransactionsFilterKey),
        value: z.string()
    })
);

export const transactionSearchQuerySchema = z.object({
    sortKey: z.enum(TransactionsSortKey).optional(),
    sortDirection: z
        .preprocess(val => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(SortDirection))
        .optional(),
    offset: z.coerce.number().int().min(0).optional().default(0),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
    startDate: QueryField.date().optional(),
    endDate: QueryField.date().optional(),
    // A JSON array of { key, value }.
    filters: z
        .string()
        .optional()
        .transform((v, ctx) => {
            if (!v) {
                return undefined;
            }

            let json: unknown;
            try {
                json = JSON.parse(v);
            } catch {
                ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
                return z.NEVER;
            }

            const filters = searchFiltersSchema.safeParse(json);
            if (!filters.success) {
                ctx.addIssue({ code: 'custom', message: 'Expected an array of { key, value } filters' });
                return z.NEVER;
            }
            return filters.data;
        }),
    includeHidden: QueryField.boolean().optional()
});

export function createTransactionRouter(
    logger: IAppLogger,
    accountData: IFinanceAccountData,
    categoryData: IFinanceCategoryData,
    transactionsData: IFinanceTransactionData
) {
    const router = Router();
    const controller = new TransactionController(logger, accountData, categoryData, transactionsData);
    const handler = new OperationHandler(logger);

    // GET / - Search Transactions
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(req, res, op, { query: transactionSearchQuerySchema }, (context, { query }) => {
            return controller.getTransactions(context, query);
        });
    });

    // POST / - Create Transaction
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createTransaction' };
        handler.execute(req, res, op, { body: createTransactionSchema }, (context, { body }) => {
            return controller.createTransaction(context, body);
        });
    });

    // GET /merchants - Get Unique Merchants
    router.get('/merchants', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactionMerchants' };
        handler.execute(req, res, op, context => {
            return controller.getTransactionMerchants(context);
        });
    });

    // GET /spending - Get Spending by Category
    const spendingQuerySchema = z.object({
        period: z.enum(CalendarPeriod),
        asOfDate: QueryField.date().optional()
    });

    router.get('/spending', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getSpendingByCategory' };
        handler.execute(req, res, op, { query: spendingQuerySchema }, (context, { query }) => {
            return controller.getSpendingByCategory(context, query.period, query.asOfDate);
        });
    });

    // GET /export - Export Transactions
    const exportQuerySchema = z.object({
        accountId: z.string().min(1).optional()
    });

    router.get('/export', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportTransactions' };
        handler.execute(req, res, op, { query: exportQuerySchema }, (context, { query }) => {
            return controller.exportTransactions(context, query.accountId);
        });
    });

    // POST /import - Import Transactions
    const importQuerySchema = z.object({
        dryRun: QueryField.boolean().optional().default(false),
        accountId: z.string().min(1).optional()
    });

    router.post('/import', singleFileUpload, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importTransactions' };
        handler.execute(req, res, op, { query: importQuerySchema }, (context, { query }) => {
            return controller.importTransactions(context, req.file?.buffer, query.dryRun, query.accountId);
        });
    });

    // GET /:id - Get Transaction
    router.get('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransaction' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getTransaction(context, params.id);
        });
    });

    // PUT /:id - Update Transaction
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveTransaction' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateTransactionSchema },
            (context, { params, body }) => {
                return controller.saveTransaction(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Transaction
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteTransaction' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteTransaction(context, params.id);
        });
    });

    return router;
}
