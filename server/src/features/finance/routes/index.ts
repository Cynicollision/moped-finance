import { Router } from 'express';
import { DatabaseClient } from '@core/db';
import { AppLogger } from '@core/logger';
import { FinanceData, IFinanceData } from './../data';
import { createAccountRouter } from './account-routes';
import { createBudgetStreamRouter } from './budget-stream-routes';
import { createCategoryRouter } from './category-routes';
import { createInstitutionRouter } from './institution-routes';
import { createTransactionRouter } from './transaction-routes';

export function createFinanceRouter(financeData: IFinanceData, logger: AppLogger) {
    const router = Router();

    router.use('/data/accounts', createAccountRouter(financeData.accounts, financeData.balanceHistory, financeData.transactions, logger));
    router.use('/data/transactions', createTransactionRouter(financeData.transactions, logger));
    router.use('/data/budget-streams', createBudgetStreamRouter(financeData.budgetStream, logger));
    router.use('/data/categories', createCategoryRouter(financeData.categories, logger));
    router.use('/data/institutions', createInstitutionRouter(financeData.institutions, logger));

    return router;
}

export function createFinanceModule(db: DatabaseClient, logger: AppLogger) {
    return createFinanceRouter(FinanceData.forDatabase(db), logger);
}
