import { Router } from 'express';
import { AuthMiddleware } from '@server/auth';
import { DatabaseClient } from '@server/data';
import { IAppLogger } from '@server/logging';
import { SecretBox } from '@server/utility';
import { AccountData, BalanceHistoryData, createAccountRouter } from './accounts';
import { BankSyncController, createBankSyncRouter, ISimplefinClient, SimplefinData } from './bank-sync';
import { BudgetStreamData, createBudgetStreamRouter } from './budget';
import { CategoryData, CategoryGroupData, createCategoryRouter } from './categories';
import { InstitutionData, createInstitutionRouter } from './institutions';
import { SettingsData, createSettingsRouter } from './settings';
import { TransactionData, createTransactionRouter } from './transactions';

export { SimplefinData, simplefinClientFromEnvironment } from './bank-sync';
export { CategoryData, CategoryGroupData, DefaultCategories } from './categories';

/** What bank sync needs from the environment: Bridge's client and the `ENCRYPTION_KEY` box, if the key is set. */
export interface BankSyncConfig {
    client: ISimplefinClient;
    secretBox: SecretBox | undefined;
}

export function buildFinanceRouter(
    logger: IAppLogger,
    db: DatabaseClient,
    authMiddleware: AuthMiddleware,
    bankSync: BankSyncConfig
): Router {
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

    const bankSyncController = new BankSyncController(new SimplefinData(db), bankSync.client, bankSync.secretBox);
    const bankSyncRouter = createBankSyncRouter(logger, bankSyncController);
    router.use('/v1/bank-sync', authMiddleware.resolveUser, authMiddleware.requireAuth, bankSyncRouter);

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
