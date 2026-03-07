import { Router, Request, Response } from 'express';
import { GetTransactionsOptions } from '@shared/finance/contracts';
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

router.get('/data/account/:accountId/transactions', async (req: Request, res: Response) => {
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
        const result = await financeLogic.getCategories(user!.id);

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

function getTransactionOptions(req: Request): GetTransactionsOptions {
    const sortKey = req.query.sort as string;
    const sortDirection = req.query.direction as string;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    return {
        sortKey: sortKey,
        sortDirection: sortDirection,
        offset: offset,
        limit: limit
    };
}

export default router;