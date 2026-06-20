import { Router, Request } from 'express';
import multer from 'multer';
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

export function createTransactionRouter(logger: IAppLogger, accountData: IFinanceAccountData, categoryData: IFinanceCategoryData, transactionsData: IFinanceTransactionData) {
    const router = Router();
    const controller = new TransactionController(logger, accountData, categoryData, transactionsData);
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Transaction');

    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactions' };
        handler.execute(req, res, op, (context) => {
            const options = getTransactionSearchOptions(req);
            return controller.getTransactions(context, options);
        });
    });

    router.post('/', validator.body(createTransactionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createTransaction' };
        handler.execute(req, res, op, (context) => {
            const transaction: Transaction = req.body;
            return controller.createTransaction(context, transaction);
        });
    });

    router.get('/merchants', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactionMerchants' };
        handler.execute(req, res, op, (context) => {
            return controller.getTransactionMerchants(context);
        });
    });

    router.get('/cashflow', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransactionCashflowByCategory' };
        handler.execute(req, res, op, (context) => {
            const period = req.query.period as CalendarPeriod;
            const asOfDate = req.query.asOfDate as string;
            // TODO validate params
            return controller.getTransactionCashflowByCategory(context, period, asOfDate);
        });
    });

    router.get('/export', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'exportTransactions' };
        handler.execute(req, res, op, (context) => {
            // TODO validate params
            const accountId = req.query.accountId as string;
            return controller.exportTransactions(context, accountId);
        });
    });

    router.post('/import', upload.single('file'), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'importTransactions' };
        handler.execute(req, res, op, (context) => {
            const dryRun = req.query.dryRun === 'true';
            const accountId = req.query.accountId as string;
            return controller.importTransactions(context, req.file?.buffer, dryRun, accountId);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getTransaction' };
        handler.execute(req, res, op, (context) => {
            return controller.getTransaction(context, req.params.id);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateTransactionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveTransaction' };
        handler.execute(req, res, op, (context) => {
            const transaction: Transaction = req.body;
            transaction.id = req.params.id; // ensure ID holds
            return controller.saveTransaction(context, transaction);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteTransaction' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteTransaction(context, req.params.id);
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
