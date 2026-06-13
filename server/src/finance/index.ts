import { Router } from 'express';
import { DatabaseClient } from '@server-core/db';
import { AppLogger } from '@server-core/logger';
import { FinanceAccountData, FinanceBalanceHistoryData, createAccountRouter } from './accounts';
import { FinanceBudgetStreamData, createBudgetStreamRouter } from './budget';
import { FinanceCategoriesData, createCategoryRouter } from './categories';
import { FinanceInstitutionsData, createInstitutionRouter } from './institutions';
import { FinanceTransactionsData, createTransactionRouter } from './transactions';

export function createFinanceModule(db: DatabaseClient, logger: AppLogger) {
    const router = Router();
    const drizzle = db.drizzle;

    // Instantiate data classes
    const accountData = new FinanceAccountData(drizzle);
    const balanceHistoryData = new FinanceBalanceHistoryData(drizzle);
    const budgetStreamData = new FinanceBudgetStreamData(drizzle);
    const categoriesData = new FinanceCategoriesData(drizzle);
    const institutionsData = new FinanceInstitutionsData(drizzle);
    const transactionsData = new FinanceTransactionsData(drizzle);

    // Register routes
    router.use('/data/accounts', createAccountRouter(logger, accountData, balanceHistoryData, transactionsData));
    router.use('/data/transactions', createTransactionRouter(logger, transactionsData));
    router.use('/data/budget-streams', createBudgetStreamRouter(logger, budgetStreamData));
    router.use('/data/categories', createCategoryRouter(logger, categoriesData));
    router.use('/data/institutions', createInstitutionRouter(logger, institutionsData));

    return router;
}
