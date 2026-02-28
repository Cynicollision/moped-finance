import { Account } from '@shared/types/finance/entities/account';
import { BalanceHistory } from '@shared/types/finance/entities/balance-history';
import { Category } from '@shared/types/finance/entities/category';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Transaction } from '@shared/types/finance/entities/transaction';
import { DatabaseError, databasePool } from './db-client';

export class FinanceData {

    public async getProfileByUserId(userId: string): Promise<FinanceProfile | null> {
        try {
            const result = await databasePool.query(
                'SELECT id, user_id as "userId" FROM finance.profiles WHERE user_id = $1',
                [userId]
            );
            return result.rows[0] || null;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getInstitutions(profileId: string): Promise<Institution[]> {
        try {
            const result = await databasePool.query(
                'SELECT id, profile_id as "profileId", name FROM finance.institutions WHERE profile_id = $1',
                [profileId]
            );
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getCategories(profileId: string): Promise<Category[]> {
        try {
            const result = await databasePool.query(
                'SELECT id, profile_id as "profileId", name, group_name as "group" FROM finance.categories WHERE profile_id = $1',
                [profileId]
            );
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getAccounts(profileId: string): Promise<Account[]> {
        try {
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
                    is_hidden as "isHidden",
                    is_retirement as "isRetirement"
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
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getTransactions(accountId: string): Promise<Transaction[]> {
        try {
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
                    is_hidden as "isHidden",
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
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getBalanceHistory(accountId: string): Promise<BalanceHistory[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    id, 
                    account_id as "accountId", 
                    date, 
                    balance 
                FROM finance.balance_history 
                WHERE account_id = $1`,
                [accountId]
            );

            return result.rows.map(row => ({
                ...row,
                balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
            }));
        }
        catch (err) {
            throw new DatabaseError();
        }
    }
}