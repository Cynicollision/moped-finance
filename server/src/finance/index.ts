import { Router } from 'express';
import { AuthMiddleware } from '@server-core/auth';
import { DatabaseClient } from '@server-core/database';
import { IAppLogger } from '@server-core/logger';
import { FinanceAccountData, FinanceBalanceHistoryData, createAccountRouter } from './accounts';
import { FinanceBudgetStreamData, createBudgetStreamRouter } from './budget';
import { FinanceCategoryData, FinanceCategoryGroupData, createCategoryRouter } from './categories';
import { FinanceInstitutionData, createInstitutionRouter } from './institutions';
import { FinanceTransactionData, createTransactionRouter } from './transactions';

export function buildFinanceRouter(logger: IAppLogger, db: DatabaseClient, authMiddleware: AuthMiddleware): Router {
    const router = Router();

    const accountData = new FinanceAccountData(db);
    const balanceHistoryData = new FinanceBalanceHistoryData(db);
    const budgetStreamData = new FinanceBudgetStreamData(db);
    const categoryGroupData = new FinanceCategoryGroupData(db);
    const categoryData = new FinanceCategoryData(db);
    const institutionData = new FinanceInstitutionData(db);
    const transactionData = new FinanceTransactionData(db);

    const accounts = createAccountRouter(logger, accountData, balanceHistoryData, transactionData);
    router.use('/v1/accounts', authMiddleware.resolveUser, authMiddleware.requireAuth, accounts);

    const budgetStreams = createBudgetStreamRouter(logger, budgetStreamData);
    router.use('/v1/budget-streams', authMiddleware.resolveUser, authMiddleware.requireAuth, budgetStreams);

    const categories = createCategoryRouter(logger, categoryData, categoryGroupData);
    router.use('/v1/categories', authMiddleware.resolveUser, authMiddleware.requireAuth, categories);

    const institutions = createInstitutionRouter(logger, institutionData);
    router.use('/v1/institutions', authMiddleware.resolveUser, authMiddleware.requireAuth, institutions);

    const transactions = createTransactionRouter(logger, accountData, categoryData, transactionData);
    router.use('/v1/transactions', authMiddleware.resolveUser, authMiddleware.requireAuth, transactions);

    return router;
}
