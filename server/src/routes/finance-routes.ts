import { Router, Request, Response } from 'express';
import { SortDirection } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, GetTransactionsOptions } from '@shared/finance/contracts';
import { TransactionsSortKey } from '@shared/finance/enum';
import { ApiHandler } from './api-handler';
import { FinanceData } from './../data-access/finance-data';
import { FinanceLogic } from './../feature-logic/finance-logic';

const router = Router();
const financeData = new FinanceData();
const financeLogic = new FinanceLogic(financeData);

router.get('/data/profile', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await financeLogic.getProfile(user!.id);
        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/accounts', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await financeLogic.getAccounts(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/accounts/:accountId/balance-history', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const accountId = req.params.accountId;

        const options: GetAccountBalanceHistoryOptions = {
            startDate: req.query.startDate as string,
            endDate: req.query.endDate as string
        };

        const result = await financeLogic.getAccountBalanceHistory(user!.id, accountId, options);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const accountId = req.params.accountId;
        const options = getTransactionOptions(req);
        const result = await financeLogic.getTransactions(user!.id, options, accountId);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/institutions', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await financeLogic.getInstitutions(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/categories', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const activeOnly = req.query.activeOnly === 'true';
        const result = await financeLogic.getCategories(user!.id, activeOnly);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/transactions', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const options = getTransactionOptions(req);
        const result = await financeLogic.getTransactions(user!.id, options);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/transactions/merchants', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await financeLogic.getTransactionMerchants(user!.id);
        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});


function getTransactionOptions(req: Request): GetTransactionsOptions {
    const sortKey = req.query.sortKey as TransactionsSortKey;
    const sortDirection = req.query.sortDirection as SortDirection;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const limit = parseInt(req.query.limit as string, 10) || 50;

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
        filters
    };
}

export default router;