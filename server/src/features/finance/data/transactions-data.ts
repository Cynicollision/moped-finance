import { SortDirection } from '@shared/core/enum';
import { Transaction } from '@shared/finance/types';
import { SpendingStream, TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { IOwnedResourceData } from './../../../core/interfaces';
import { databasePool } from './../../../core/db-client';

export interface IFinanceTransactionsData extends IOwnedResourceData<Transaction> {
    search(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]>;
    retrieveMerchants(userId: string): Promise<string[]>;
    retrieveSpendingByCategory(userId: string, startDate: Date, endDate: Date): Promise<SpendingStream[]>;
    retrieveSingle(userId: string, id: string): Promise<Transaction | null>;
    update(userId: string, transaction: Transaction): Promise<Transaction | null>;
    delete(userId: string, id: string): Promise<boolean>;
}

export class FinanceTransactionsData implements IFinanceTransactionsData {

    public async search(userId: string, options: TransactionSearchOptions, accountId?: string): Promise<Transaction[]> {
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
                    JOIN finance.categories AS c ON c.id = t.category_id
                WHERE a.user_id = $1`;

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

        if (!options.includeHidden) {
            query += ` AND t.is_hidden = false`;
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
                else if (filter.key === TransactionsFilterKey.Group) {
                    params.push(filter.value);
                    query += ` AND c.category_group = $${params.length}`;
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

    public async retrieveMerchants(userId: string): Promise<string[]> {
        const query = `SELECT t.merchant
                FROM finance.transactions AS t
                    JOIN finance.accounts AS a ON a.id = t.account_id
                WHERE a.user_id = $1
                GROUP BY t.merchant
                ORDER BY t.merchant`;

        const params = [userId]

        const result = await databasePool.query(query, params);

        return result.rows.map(row => row.merchant);
    }

    public async retrieveSingle(userId: string, id: string): Promise<Transaction | null> {
        const query = `SELECT 
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
                WHERE a.user_id = $1 AND t.id = $2`;

        const params = [userId, id];

        const result = await databasePool.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        };
    }

    public async retrieveSpendingByCategory(userId: string, startDate: Date, endDate: Date): Promise<SpendingStream[]> {
        const query = `SELECT 
                            t.category_id AS "categoryId", 
                            SUM(t.amount) AS "amount"
                        FROM finance.transactions AS t
                            JOIN finance.accounts AS a ON a.id = t.account_id
                        WHERE a.user_id = $1 
                            AND t.date >= $2 
                            AND t.date <= $3
                            AND a.hide_from_cashflow = false
                        GROUP BY t.category_id`;

        const params = [userId, startDate, endDate];

        const result = await databasePool.query(query, params);

        return result.rows.map(row => ({
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        }));
    }

    public async update(userId: string, transaction: Transaction): Promise<Transaction | null> {
        const query = `UPDATE finance.transactions
                        SET 
                            merchant = $1,
                            category_id = $2,
                            date = $3,
                            notes = $4,
                            is_hidden = $5
                        WHERE id = $6
                            AND account_id IN (SELECT id FROM finance.accounts WHERE user_id = $7)
                        RETURNING 
                            id, 
                            account_id AS "accountId", 
                            category_id AS "categoryId", 
                            date, 
                            amount, 
                            merchant, 
                            original_statement as "originalStatement", 
                            notes, 
                            is_hidden AS "isHidden",
                            is_split AS "isSplit", 
                            split_parent_id AS "splitParentId"`;

        const params = [
            transaction.merchant,
            transaction.categoryId,
            transaction.date,
            transaction.notes,
            transaction.isHidden,
            transaction.id,
            userId
        ];

        const result = await databasePool.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        };
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const deleteQuery = `DELETE FROM finance.transactions WHERE id = $1 AND account_id IN (SELECT id FROM finance.accounts WHERE user_id = $2)`;
        const result = await databasePool.query(deleteQuery, [id, userId]);
        return (result.rowCount ?? 0) > 0;
    }
}