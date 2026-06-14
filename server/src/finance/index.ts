import { Router } from 'express';
import { DatabaseClient } from '@server-core/db-client';
import { AppLogger } from '@server-core/logger';
import { FinanceAccountData, FinanceBalanceHistoryData, createAccountRouter } from './accounts';
import { FinanceBudgetStreamData, createBudgetStreamRouter } from './budget';
import { FinanceCategoryData, FinanceCategoryGroupData, createCategoryRouter } from './categories';
import { FinanceInstitutionData, createInstitutionRouter } from './institutions';
import { FinanceTransactionData, createTransactionRouter } from './transactions';

export function createFinanceModule(db: DatabaseClient, logger: AppLogger) {
    const router = Router();
    // Instantiate data classes
    const accountData = new FinanceAccountData(db);
    const balanceHistoryData = new FinanceBalanceHistoryData(db);
    const budgetStreamData = new FinanceBudgetStreamData(db);
    const categoryGroupData = new FinanceCategoryGroupData(db);
    const categoryData = new FinanceCategoryData(db);
    const institutionData = new FinanceInstitutionData(db);
    const transactionData = new FinanceTransactionData(db);

    // Register routes
    router.use('/v1/accounts', createAccountRouter(logger, accountData, balanceHistoryData, categoryData, transactionData));
    router.use('/v1/transactions', createTransactionRouter(logger, accountData, categoryData, transactionData));
    router.use('/v1/budget-streams', createBudgetStreamRouter(logger, budgetStreamData));
    router.use('/v1/categories', createCategoryRouter(logger, categoryData, categoryGroupData));
    router.use('/v1/institutions', createInstitutionRouter(logger, institutionData));

    return router;
}
