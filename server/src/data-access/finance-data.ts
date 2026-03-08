import { SortDirection } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, GetTransactionsOptions } from '@shared/finance/contracts';
import { TransactionsSortKey, TransactionsFilterKey } from '@shared/finance/enum';
import { Account, BalanceHistory, Category, FinanceProfile, Institution, Transaction } from '@shared/finance/types';
import { DatabaseError, databasePool } from './db-client';

export class FinanceData {

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetAccountBalanceHistoryOptions = {}): Promise<BalanceHistory[]> {
        try {
            let query = `SELECT
                    bh.id,
                    bh.account_id AS "accountId",
                    bh.date,
                    bh.balance
                FROM finance.balance_history AS bh
                    JOIN finance.accounts AS a ON a.id = bh.account_id
                    JOIN finance.profiles AS p ON p.id = a.profile_id
                WHERE p.user_id = $1
                    AND bh.account_id = $2`;

            const params: (string | number)[] = [userId, accountId];

            if (options.startDate) {
                params.push(options.startDate);
                query += ` AND bh.date >= $${params.length}`;
            }

            if (options.endDate) {
                params.push(options.endDate);
                query += ` AND bh.date <= $${params.length}`;
            }

            const result = await databasePool.query(query, params);

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

    public async getCategories(userId: string, activeOnly: boolean): Promise<Category[]> {
        try {
            let query = `SELECT 
                    c.id, 
                    c.profile_id AS "profileId",
                    c.category_type AS "type",
                    c.category_group AS "group",
                    c.icon,
                    c.name,
                    c.is_active AS "isActive"
                FROM finance.categories AS c
                    JOIN finance.profiles AS p ON p.id = c.profile_id
                WHERE p.user_id = $1`;

            if (activeOnly) {
                query += ' AND c.is_active = true';
            }

            const result = await databasePool.query(query, [userId]);
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
            // TODO: something better with this, or capture error + handle in ApiHandler
            throw new DatabaseError();
        }
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
        try {
            let query = `SELECT 
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
                WHERE p.user_id = $1`;

            const params: (string | number)[] = [userId];

            if (accountId) {
                params.push(accountId);
                query += ` AND a.id = $${params.length}`;
            }

            if (options.minAmount !== undefined) {
                params.push(options.minAmount);
                query += ` AND t.amount >= $${params.length}`;
            }

            if (options.maxAmount !== undefined) {
                params.push(options.maxAmount);
                query += ` AND t.amount <= $${params.length}`;
            }

            if (options.startDate) {
                params.push(options.startDate);
                query += ` AND t.date >= $${params.length}`;
            }

            if (options.endDate) {
                params.push(options.endDate);
                query += ` AND t.date <= $${params.length}`;
            }

            if (options.filters) {
                for (const filter of options.filters) {
                    if (filter.key === TransactionsFilterKey.Merchant) {
                        params.push(`%${filter.value}%`);
                        query += ` AND t.merchant ILIKE $${params.length}`;
                    }
                    else if (filter.key === TransactionsFilterKey.Category) {
                        params.push(filter.value);
                        query += ` AND t.category_id = $${params.length}`;
                    }
                    else if (filter.key === TransactionsFilterKey.AccountId) {
                        params.push(filter.value);
                        query += ` AND t.account_id = $${params.length}`;
                    }
                }
            }

            const sort = Object.values(TransactionsSortKey).includes(options.sortKey as TransactionsSortKey)
                ? options.sortKey
                : TransactionsSortKey.Date;

            const dirInput = (options.sortDirection || '').toUpperCase();
            const dir = Object.values(SortDirection).includes(dirInput as SortDirection) ? dirInput : SortDirection.Desc;

            query += ` ORDER BY t.${sort} ${dir}, t.id ASC`;

            if (options.limit !== undefined) {
                params.push(options.limit);
                query += ` LIMIT $${params.length}`;
            }

            if (options.offset !== undefined) {
                params.push(options.offset);
                query += ` OFFSET $${params.length}`;
            }

            const result = await databasePool.query(query, params);

            return result.rows.map(row => ({
                ...row,
                amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
            }));
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        try {
            const query = `SELECT t.merchant
                FROM finance.transactions AS t
                    JOIN finance.accounts AS a ON a.id = t.account_id
                    JOIN finance.profiles AS p ON p.id = a.profile_id
                WHERE p.user_id = $1
                GROUP BY t.merchant
                ORDER BY t.merchant`;

            const params = [ userId ]

            const result = await databasePool.query(query, params);

            return result.rows.map(row => row.merchant);
        }
        catch {
            throw new DatabaseError();
        }
    }
}