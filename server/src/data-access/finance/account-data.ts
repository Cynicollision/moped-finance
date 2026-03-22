import { EntityIdPrefix } from '@shared/core/enum';
import { Account } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';

export interface IFinanceAccountData {
    retrieveAll(userId: string): Promise<Account[]>;
    retrieveSingle(userId: string, accountId: string): Promise<Account | null>;
}

export class FinanceAccountData implements IFinanceAccountData {

    public async retrieveAll(userId: string): Promise<Account[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    a.id, 
                    a.created_at AS "createdAt",
                    a.updated_at AS "updatedAt",
                    a.user_id AS "userId", 
                    a.institution_id AS "institutionId", 
                    a.name,
                    a.account_category AS "category", 
                    a.account_group AS "group", 
                    a.account_type AS "type", 
                    a.balance, 
                    a.is_hidden AS "isHidden",
                    a.is_manual AS "isManual",
                    a.is_retirement AS "isRetirement",
                    a.hide_from_cashflow AS "hideFromCashflow"
                FROM finance.accounts AS a
                WHERE a.user_id = $1`,
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

    public async retrieveSingle(userId: string, accountId: string): Promise<Account | null> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    a.id, 
                    a.created_at AS "createdAt",
                    a.updated_at AS "updatedAt",
                    a.user_id AS "userId", 
                    a.institution_id AS "institutionId", 
                    a.name,
                    a.account_category AS "category", 
                    a.account_group AS "group",
                    a.account_type AS "type", 
                    a.balance, 
                    a.is_hidden AS "isHidden",
                    a.is_manual AS "isManual",
                    a.is_retirement AS "isRetirement",
                    a.hide_from_cashflow AS "hideFromCashflow"
                FROM finance.accounts AS a
                WHERE a.user_id = $1 AND a.id = $2`,
                [userId, accountId]
            );

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    ...row,
                    // pg driver returns numeric/bigint as strings to preserve precision
                    balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
                };
            }
            return null;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }
}