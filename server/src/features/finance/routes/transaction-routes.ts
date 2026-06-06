import { Router, Request } from 'express';
import { CalendarPeriod, SortDirection } from '@shared/common/enum';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsSortKey } from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { RequestSchemaValidator } from '@core/validation';
import { TransactionController } from './../controllers/transaction-controller';
import { IFinanceTransactionsData } from './../data/transactions-data';
import { createTransactionSchema, updateTransactionSchema } from './../schema/transactions-schema';

export function createTransactionRouter(
    transactionsData: IFinanceTransactionsData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new TransactionController(logger, transactionsData);
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Transaction');

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getTransactions', (context) => {
            const options = getTransactionSearchOptions(req);
            return controller.getTransactions(context.userId!, options);
        });
    });

    router.post('/', validator.body(createTransactionSchema), (req, res) => {
        handler.execute(req, res, 'createTransaction', (context) => {
            const transaction: Transaction = req.body;
            return controller.createTransaction(context.userId!, transaction);
        });
    });

    router.get('/merchants', (req, res) => {
        handler.execute(req, res, 'getTransactionMerchants', (context) => {
            return controller.getTransactionMerchants(context.userId!);
        });
    });

    router.get('/spending', (req, res) => {
        handler.execute(req, res, 'getTransactionSpendingByCategory', (context) => {
            const period = req.query.period as CalendarPeriod;
            const asOfDate = req.query.asOfDate as string;
            return controller.getTransactionSpendingByCategory(context.userId!, period, asOfDate);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'getTransaction', (context) => {
            return controller.getTransaction(context.userId!, req.params.id);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateTransactionSchema), (req, res) => {
        handler.execute(req, res, 'saveTransaction', (context) => {
            const transaction: Transaction = req.body;
            transaction.id = req.params.id; // ensure ID holds
            return controller.saveTransaction(context.userId!, transaction);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'deleteTransaction', (context) => {
            return controller.deleteTransaction(context.userId!, req.params.id);
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
