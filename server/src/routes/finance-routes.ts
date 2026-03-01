import { Router, Request, Response } from 'express';
import { getAuthenticatedUser } from './../utility/auth-request-util';
import { ApiResponseHandler } from './../utility/api-response-handler';
import { FinanceData } from './../data/finance-data';
import { FinanceLogic } from './../logic/finance-logic';

const router = Router();
const financeData = new FinanceData();
const financeLogic = new FinanceLogic(financeData);

router.get('/data/profile', async (req: Request, res: Response) => {
  try {
    const user = getAuthenticatedUser(req);
    const result = await financeLogic.getProfile(user.id);
    ApiResponseHandler.succeed(res, result);
  }
  catch (error) {
    ApiResponseHandler.error(res, error);
  }
});

router.get('/data/accounts', async (req: Request, res: Response) => {
  try {
    const user = getAuthenticatedUser(req);
    const result = await financeLogic.getAccounts(user.id);
    ApiResponseHandler.succeed(res, result);
  }
  catch (error) {
    ApiResponseHandler.error(res, error);
  }
});

router.get('/data/institutions', async (req: Request, res: Response) => {
  try {
    const user = getAuthenticatedUser(req);
    const result = await financeLogic.getInstitutions(user.id);
    ApiResponseHandler.succeed(res, result);
  }
  catch (error) {
    ApiResponseHandler.error(res, error);
  }
});

router.get('/data/categories', async (req: Request, res: Response) => {
  try {
    const user = getAuthenticatedUser(req);
    const result = await financeLogic.getCategories(user.id);
    ApiResponseHandler.succeed(res, result);
  }
  catch (error) {
    ApiResponseHandler.error(res, error);
  }
});

router.get('/data/transactions', async (req: Request, res: Response) => {
  try {
    const sort = req.query.sort as string;
    const direction = req.query.direction as string;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const user = getAuthenticatedUser(req);
    const result = await financeLogic.getTransactions(user.id, { sort, direction, offset, limit });
    ApiResponseHandler.succeed(res, result);
  }
  catch (error) {
    ApiResponseHandler.error(res, error);
  }
});

// TODO
// router.get('/data/account/:accountId/transactions', async (req: Request, res: Response) => {
//   await handleAuthenticatedRequest(req, res, async (user) => { // TODO: Update to new pattern
//     return await financeLogic.getAccountTransactions(req.params.accountId);
//   });
// });

// router.get('/data/account/:accountId/balance-history', async (req: Request, res: Response) => {
//   await handleAuthenticatedRequest(req, res, async (user) => {
//     return await financeLogic.getAccountBalanceHistory(req.params.accountId);
//   });
//});

export default router;