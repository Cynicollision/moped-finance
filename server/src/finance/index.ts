import { Router } from 'express';
import { DatabaseClient } from '@server-core/db-client';
import { AppLogger } from '@server-core/logger';
import { FinanceAccountData, FinanceBalanceHistoryData, createAccountRouter } from './accounts';
import { FinanceBudgetStreamData, createBudgetStreamRouter } from './budget';
import { FinanceCategoriesData, createCategoryRouter } from './categories';
import { FinanceInstitutionsData, createInstitutionRouter } from './institutions';
import { FinanceTransactionsData, createTransactionRouter } from './transactions';

export function createFinanceModule(db: DatabaseClient, logger: AppLogger) {
    const router = Router();
    // Instantiate data classes
    const accountData = new FinanceAccountData(db);
    const balanceHistoryData = new FinanceBalanceHistoryData(db);
    const budgetStreamData = new FinanceBudgetStreamData(db);
    const categoriesData = new FinanceCategoriesData(db);
    const institutionsData = new FinanceInstitutionsData(db);
    const transactionsData = new FinanceTransactionsData(db);

    // Register routes
    router.use('/v1/accounts', createAccountRouter(logger, accountData, balanceHistoryData, categoriesData, transactionsData));
    router.use('/v1/transactions', createTransactionRouter(logger, accountData, categoriesData, transactionsData));
    router.use('/v1/budget-streams', createBudgetStreamRouter(logger, budgetStreamData));
    router.use('/v1/categories', createCategoryRouter(logger, categoriesData));
    router.use('/v1/institutions', createInstitutionRouter(logger, institutionsData));

    return router;
}
