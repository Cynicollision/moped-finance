import { Router, Request, Response } from 'express';
import { handleAuthenticatedRequest } from './../utility/auth-request-util';
import { FinanceData } from './../data/finance-data';
import { FinanceLogic } from './../logic/finance-logic';

const router = Router();
const financeData = new FinanceData();
const financeLogic = new FinanceLogic(financeData);

router.get('/data/profile', async (req: Request, res: Response) => {
  // TODO use or remove
  //const related = (req.query.related as string)?.split(',') || []; 
  const full = req.query.full === 'true';

  await handleAuthenticatedRequest(req, res, async (user) => {
    return await financeLogic.getFinanceProfileByUserId(user.id);
  });
});

router.get('/data/account/:accountId/transactions', async (req: Request, res: Response) => {
  await handleAuthenticatedRequest(req, res, async (user) => {
    return await financeLogic.getAccountTransactions(req.params.accountId);
  });
});

router.get('/data/account/:accountId/balance-history', async (req: Request, res: Response) => {
  await handleAuthenticatedRequest(req, res, async (user) => {
    return await financeLogic.getAccountBalanceHistory(req.params.accountId);
  });
});

export default router;