import { Router, Request, Response } from 'express';
import { FinanceData } from './finance-data';
import { FinanceLogic } from './finance-logic';
import { FinanceApiHandler } from './finance-api-handler';

const router = Router();
const financeData = new FinanceData();
const financeLogic = new FinanceLogic(financeData);
const apiHandler = new FinanceApiHandler(financeLogic);

router.get('/data/profile', apiHandler.getFinanceProfile.bind(apiHandler));
router.get('/data/accounts', apiHandler.getAccounts.bind(apiHandler));
router.get('/data/institutions', apiHandler.getInstitutions.bind(apiHandler));
router.get('/data/categories', apiHandler.getCategories.bind(apiHandler));
router.get('/data/transactions', apiHandler.getTransaction.bind(apiHandler));

export default router;