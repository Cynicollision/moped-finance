import { EntityIdPrefix, SortDirection } from '@shared/core/enum';
import { Transaction } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';
import { GetTransactionsOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';

export interface IFinanceTransactionsData {
    search(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]>;
    retrieveMerchants(userId: string): Promise<string[]>;
}

export class FinanceTransactionsData implements IFinanceTransactionsData {

    public async search(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
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

    public async retrieveMerchants(userId: string): Promise<string[]> {
        try {
            const query = `SELECT t.merchant
                    FROM finance.transactions AS t
                        JOIN finance.accounts AS a ON a.id = t.account_id
                        JOIN finance.profiles AS p ON p.id = a.profile_id
                    WHERE p.user_id = $1
                    GROUP BY t.merchant
                    ORDER BY t.merchant`;

            const params = [userId]

            const result = await databasePool.query(query, params);

            return result.rows.map(row => row.merchant);
        }
        catch {
            throw new DatabaseError();
        }
    }
}