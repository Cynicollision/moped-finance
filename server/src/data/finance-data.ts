import { databasePool } from './db-client';
import { Account } from '@shared/types/finance/entities/account';
import { BalanceHistory } from '@shared/types/finance/entities/balance-history';
import { Category } from '@shared/types/finance/entities/category';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Transaction } from '@shared/types/finance/entities/transaction';

export class FinanceData {

    public async getProfileByUserId(userId: string): Promise<FinanceProfile | null> {
        const result = await databasePool.query(
            'SELECT id, user_id as "userId" FROM finance.profiles WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] || null;
    }

    public async createProfile(profile: FinanceProfile): Promise<void> {
        await databasePool.query(
            'INSERT INTO finance.profiles (id, user_id) VALUES ($1, $2)',
            [profile.id, profile.userId]
        );
    }

    public async getInstitutions(profileId: string): Promise<Institution[]> {
        const result = await databasePool.query(
            'SELECT id, profile_id as "profileId", name FROM finance.institutions WHERE profile_id = $1',
            [profileId]
        );
        return result.rows;
    }

    public async createInstitution(institution: Institution): Promise<void> {
        await databasePool.query(
            'INSERT INTO finance.institutions (id, profile_id, name) VALUES ($1, $2, $3)',
            [institution.id, institution.profileId, institution.name]
        );
    }

    public async getAccounts(profileId: string): Promise<Account[]> {
        const result = await databasePool.query(
            `SELECT 
                id, 
                profile_id as "profileId", 
                institution_id as "institutionId", 
                name, 
                category, 
                type, 
                subtype, 
                balance, 
                hidden 
            FROM finance.accounts 
            WHERE profile_id = $1`,
            [profileId]
        );
        
        return result.rows.map(row => ({
            ...row,
            // pg driver returns numeric/bigint as strings to preserve precision
            balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
        }));
    }

    public async createAccount(account: Account): Promise<void> {
        await databasePool.query(
            `INSERT INTO finance.accounts 
            (id, profile_id, institution_id, name, category, type, subtype, balance, hidden) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                account.id, 
                account.profileId, 
                account.institutionId, 
                account.name, 
                account.category, 
                account.type, 
                account.subtype || null, 
                account.balance, 
                account.hidden
            ]
        );
    }

    public async getTransactions(accountId: string): Promise<Transaction[]> {
        const result = await databasePool.query(
            `SELECT 
                id, 
                account_id as "accountId", 
                category_id as "categoryId", 
                date, 
                amount, 
                merchant, 
                original_statement as "originalStatement", 
                notes, 
                is_split as "isSplit", 
                split_parent_id as "splitParentId"
            FROM finance.transactions 
            WHERE account_id = $1`,
            [accountId]
        );

        return result.rows.map(row => ({
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        }));
    }

    public async createTransaction(transaction: Transaction): Promise<void> {
        await databasePool.query(
            `INSERT INTO finance.transactions 
            (id, account_id, category_id, date, amount, merchant, original_statement, notes, is_split, split_parent_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                transaction.id,
                transaction.accountId,
                transaction.categoryId,
                transaction.date,
                transaction.amount,
                transaction.merchant,
                transaction.originalStatement,
                transaction.notes,
                transaction.isSplit,
                transaction.splitParentId
            ]
        );
    }

    public async getCategories(profileId: string): Promise<Category[]> {
        // "group" is a reserved keyword in SQL, so it must be quoted
        const result = await databasePool.query(
            'SELECT id, profile_id as "profileId", name, "group" FROM finance.categories WHERE profile_id = $1',
            [profileId]
        );
        return result.rows;
    }

    public async createCategory(category: Category): Promise<void> {
        await databasePool.query(
            'INSERT INTO finance.categories (id, profile_id, name, "group") VALUES ($1, $2, $3, $4)',
            [category.id, category.profileId, category.name, category.group]
        );
    }
}