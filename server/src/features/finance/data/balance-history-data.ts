import { TotalValueHistory } from '@shared/finance/contracts';
import { ValueHistoryType } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { IDatabaseClient } from '@core/interfaces';

export interface IFinanceBalanceHistoryData {
    retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]>;
    retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]>;
}

export class FinanceBalanceHistoryData implements IFinanceBalanceHistoryData {
    constructor(private db: IDatabaseClient) {}

    public async retrieveForAccount(userId: string, accountId: string, startDate: string, endDate: string): Promise<BalanceHistory[]> {
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

        const result = await this.db.query(query, params);

        return result.rows.map(row => ({
            ...row,
            balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
        }));
    }

    public async retrieveSumByDate(userId: string, type: ValueHistoryType, startDate: Date, endDate: Date): Promise<TotalValueHistory[]> {
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

        const result = await this.db.query(query, params);

        return result.rows.map(row => ({
            ...row,
            type,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        }));
    }
}