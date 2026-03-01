import { Account } from '@shared/types/finance/entities/account';
import { BalanceHistory } from '@shared/types/finance/entities/balance-history';
import { Category } from '@shared/types/finance/entities/category';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Transaction } from '@shared/types/finance/entities/transaction';
import { DatabaseError, databasePool } from './db-client';

export class FinanceData {

    // TODO
    public async getAccountBalanceHistory(accountId: string): Promise<BalanceHistory[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    id, 
                    account_id AS "accountId", 
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

    public async getAccounts(userId: string): Promise<Account[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    a.id, 
                    a.profile_id AS "profileId", 
                    a.institution_id AS "institutionId", 
                    a.name, 
                    a.category, 
                    a.type, 
                    a.subtype, 
                    a.balance, 
                    a.is_hidden AS "isHidden",
                    a.is_retirement AS "isRetirement"
                FROM finance.accounts AS a
                    JOIN finance.profiles AS p ON p.id = a.profile_id
                WHERE p.user_id = $1`,
                [userId]
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

    public async getCategories(userId: string): Promise<Category[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    c.id, 
                    c.profile_id as "profileId", 
                    c.name, 
                    group_name as "groupName"
                FROM finance.categories AS c
                    JOIN finance.profiles AS p ON p.id = c.profile_id
                WHERE p.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    i.id, 
                    i.profile_id as "profileId", 
                    i.name 
                FROM finance.institutions AS i
                    JOIN finance.profiles AS p ON i.profile_id = p.id
                WHERE p.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getProfile(userId: string): Promise<FinanceProfile | null> {
        try {
            const result = await databasePool.query(
                'SELECT id, user_id as "userId" FROM finance.profiles WHERE user_id = $1',
                [userId]
            );
            return result.rows[0] || null;
        }
        catch (err) {
            // TODO: something better with this
            throw new DatabaseError();
        }
    }

    public async getTransactions(userId: string): Promise<Transaction[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    t.id, 
                    t.account_id AS "accountId", 
                    t.category_id AS "categoryId", 
                    t.date, 
                    t.amount, 
                    t.merchant, 
                    t.original_statement as "originalStatement", 
                    t.notes, 
                    t.is_hidden AS "isHidden",
                    t.is_split AS "isSplit", 
                    t.split_parent_id AS "splitParentId"
                FROM finance.transactions AS t
                    JOIN finance.accounts AS a ON a.id = t.account_id
                    JOIN finance.profiles AS p ON p.id = a.profile_id
                WHERE p.user_id = $1`,
                [userId]
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
}