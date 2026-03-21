import { EntityIdPrefix } from '@shared/core/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]>;
    retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]>;
}

export class FinanceBalanceHistoryData implements IFinanceBalanceHistoryData {

    public async retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]> {
        try {
            let query = `SELECT
                            bh.id,
                            bh.created_at AS "createdAt",
                            bh.updated_at AS "updatedAt",
                            bh.account_id AS "accountId",
                            bh.date,
                            bh.balance
                        FROM finance.balance_history AS bh
                            JOIN finance.accounts AS a ON a.id = bh.account_id
                        WHERE a.user_id = $1
                            AND bh.account_id = $2`;

            const params: (string | number)[] = [userId, accountId];

            if (startDate) {
                params.push(startDate);
                query += ` AND bh.date >= $${params.length}`;
            }

            if (endDate) {
                params.push(endDate);
                query += ` AND bh.date <= $${params.length}`;
            }

            const result = await databasePool.query(query, params);

            return result.rows.map(row => ({
                ...row,
                balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
            }));
        }
        catch {
            throw new DatabaseError();
        }
    }

    public async retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]> {
        try {
            let query = `SELECT 
                            bh.date, 
                            SUM(bh.balance) AS "amount"
                        FROM finance.balance_history AS bh
                            JOIN finance.accounts AS a ON a.id = bh.account_id
                        WHERE a.user_id = $1
                            AND bh.date >= $2
                            AND bh.date <= $3`;

            const params: (string | Date)[] = [userId, startDate, endDate];

            if (type === ValueHistoryType.Assets) {
                query += ` AND a.account_category = 'Asset'`;
            }
            else if (type === ValueHistoryType.Liabilities) {
                query += ` AND a.account_category = 'Liability'`;
            }

            query += `
                GROUP BY bh.date
                ORDER BY bh.date DESC`;

            const result = await databasePool.query(query, params);

            return result.rows.map(row => ({
                ...row,
                type,
                amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
            }));
        }
        catch (err) {
            throw new DatabaseError();
        }
    }
}