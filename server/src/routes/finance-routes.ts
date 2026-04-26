import { Router, Request } from 'express';
import { SortDirection } from '@shared/core/enum';
import { Account, BudgetStream, Transaction } from '@shared/finance/types';
import { GetAccountBalanceHistoryOptions, TotalValueHistoryOptions, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { AppLogger } from './../core/logger';
import { DateTimeUtil } from './../utility';
import { ApiHandler } from './api-handler';
import { FinanceController } from './../features/finance-controller';
import { FinanceData } from './../features/finance/data';

const router = Router();

const logger = AppLogger.fromEnvironment();
const financeData = FinanceData.forPgDatabase();
const controller = new FinanceController(financeData);
const handler = new ApiHandler(logger);

router.get('/data/accounts', (req, res) => {
    handler.execute(req, res, 'getAccounts', (context) => {
        return controller.getAccounts(context.userId!);
    });
});

router.get('/data/accounts/total-value-history', (req, res) => {
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

router.get('/data/accounts/:accountId', (req, res) => {
    handler.execute(req, res, 'getAccount', (context) => {
        return controller.getAccount(context.userId!, req.params.accountId);
    });
});

router.post('/data/accounts', (req, res) => {
    handler.execute(req, res, 'createAccount', (context) => {
        const account: Account = req.body;
        return controller.createAccount(context.userId!, account);
    });
});

router.put('/data/accounts/:accountId', (req, res) => {
    handler.execute(req, res, 'saveAccount', (context) => {
        const account: Account = req.body;
        account.id = req.params.accountId;
        return controller.saveAccount(context.userId!, account);
    });
});

router.delete('/data/accounts/:accountId', (req, res) => {
    handler.execute(req, res, 'deleteAccount', (context) => {
        return controller.deleteAccount(context.userId!, req.params.accountId);
    });
});

router.get('/data/accounts/:accountId/balance-history', (req, res) => {
    handler.execute(req, res, 'getAccountBalanceHistory', (context) => {
        const timeframe = req.query.timeframe as HistoryTimeframe;
        const asOfDateStr = req.query.asOfDate as string;
        const asOfDate = asOfDateStr ? new Date(asOfDateStr) : DateTimeUtil.now();

        const options: GetAccountBalanceHistoryOptions = {
            asOfDate,
            timeframe
        };

        return controller.getAccountBalanceHistory(context.userId!, req.params.accountId, options);
    });
});

router.get('/data/accounts/:accountId/transactions', (req, res) => {
    handler.execute(req, res, 'getTransactions', (context) => {
        const options = getTransactionSearchOptions(req);
        return controller.getTransactions(context.userId!, options, req.params.accountId);
    });
});


router.get('/data/budget-streams', (req, res) => {
    handler.execute(req, res, 'getBudgetStreams', (context) => {
        return controller.getBudgetStreams(context.userId!);
    });
});

router.post('/data/budget-streams', (req, res) => {
    handler.execute(req, res, 'createBudgetStream', (context) => {
        const stream: BudgetStream = req.body;
        return controller.createBudgetStream(context.userId!, stream);
    });
});

router.put('/data/budget-streams/:id', (req, res) => {
    handler.execute(req, res, 'saveBudgetStream', (context) => {
        const stream: BudgetStream = req.body;
        stream.id = req.params.id; // ensure ID from URL param overrides body
        return controller.saveBudgetStream(context.userId!, stream);
    });
});

router.delete('/data/budget-streams/:id', (req, res) => {
    handler.execute(req, res, 'deleteBudgetStream', (context) => {
        return controller.deleteBudgetStream(context.userId!, req.params.id);
    });
});

router.get('/data/categories', (req, res) => {
    handler.execute(req, res, 'getCategories', (context) => {
        const activeOnly = req.query.activeOnly === 'true';
        return controller.getCategories(context.userId!, activeOnly);
    });
});

router.get('/data/institutions', (req, res) => {
    handler.execute(req, res, 'getInstitutions', (context) => {
        return controller.getInstitutions(context.userId!);
    });
});

router.get('/data/transactions', (req, res) => {
    handler.execute(req, res, 'getTransactions', (context) => {
        const options = getTransactionSearchOptions(req);
        return controller.getTransactions(context.userId!, options);
    });
});

router.get('/data/transactions/merchants', (req, res) => {
    handler.execute(req, res, 'getTransactionMerchants', (context) => {
        return controller.getTransactionMerchants(context.userId!);
    });
});

router.get('/data/transactions/spending', (req, res) => {
    handler.execute(req, res, 'getTransactionSpendingByCategory', (context) => {
        const period = req.query.period as BudgetPeriod;
        const asOfDate = req.query.asOfDate as string;
        return controller.getTransactionSpendingByCategory(context.userId!, period, asOfDate);
    });
});

router.get('/data/transactions/:id', (req, res) => {
    handler.execute(req, res, 'getTransaction', (context) => {
        return controller.getTransaction(context.userId!, req.params.id);
    });
});

router.put('/data/transactions/:id', (req, res) => {
    handler.execute(req, res, 'saveTransaction', (context) => {
        const transaction: Transaction = req.body;
        transaction.id = req.params.id; // ensure ID holds
        return controller.saveTransaction(context.userId!, transaction);
    });
});

router.delete('/data/transactions/:id', (req, res) => {
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


export default router;