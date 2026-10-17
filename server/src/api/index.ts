import { Router } from 'express';
import { AuthMiddleware } from '@server/auth';
import { DatabaseClient } from '@server/data';
import { IAppLogger } from '@server/logging';
import { AccountData, BalanceHistoryData, createAccountRouter } from './accounts';
import { BudgetStreamData, createBudgetStreamRouter } from './budget';
import { CategoryData, CategoryGroupData, createCategoryRouter } from './categories';
import { InstitutionData, createInstitutionRouter } from './institutions';
import { SettingsData, createSettingsRouter } from './settings';
import { TransactionData, createTransactionRouter } from './transactions';

export { CategoryData, CategoryGroupData, DefaultCategories } from './categories';

export function buildFinanceRouter(logger: IAppLogger, db: DatabaseClient, authMiddleware: AuthMiddleware): Router {
    const router = Router();

    const accountData = new AccountData(db);
    const balanceHistoryData = new BalanceHistoryData(db);
    const budgetStreamData = new BudgetStreamData(db);
    const categoryGroupData = new CategoryGroupData(db);
    const categoryData = new CategoryData(db);
    const institutionData = new InstitutionData(db);
    const transactionData = new TransactionData(db);
    const settingsData = new SettingsData(db);

    const accounts = createAccountRouter(logger, accountData, balanceHistoryData, transactionData);
    router.use('/v1/accounts', authMiddleware.resolveUser, authMiddleware.requireAuth, accounts);

    const budgetStreams = createBudgetStreamRouter(logger, budgetStreamData);
    router.use('/v1/budget-streams', authMiddleware.resolveUser, authMiddleware.requireAuth, budgetStreams);

    const categories = createCategoryRouter(logger, categoryData, categoryGroupData);
    router.use('/v1/categories', authMiddleware.resolveUser, authMiddleware.requireAuth, categories);

    const institutions = createInstitutionRouter(logger, institutionData, accountData);
    router.use('/v1/institutions', authMiddleware.resolveUser, authMiddleware.requireAuth, institutions);

    const settings = createSettingsRouter(logger, settingsData);
    router.use('/v1/settings', authMiddleware.resolveUser, authMiddleware.requireAuth, settings);

    const transactions = createTransactionRouter(logger, accountData, categoryData, transactionData);
    router.use('/v1/transactions', authMiddleware.resolveUser, authMiddleware.requireAuth, transactions);

    return router;
}
