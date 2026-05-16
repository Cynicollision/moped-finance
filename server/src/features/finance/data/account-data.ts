import { Account } from '@shared/finance/types';
import { IOwnedResourceData, IDatabaseClient } from '@core/interfaces';
import { DateTimeUtil } from '@core/utility';

export interface IFinanceAccountData extends IOwnedResourceData<Account> {
    retrieveAll(userId: string): Promise<Account[]>;
    create(userId: string, account: Account): Promise<Account>;
    update(userId: string, account: Account): Promise<Account | null>;
    delete(userId: string, accountId: string): Promise<boolean>;
}

export class FinanceAccountData implements IFinanceAccountData {
    constructor(private db: IDatabaseClient) { }

    public async retrieveAll(userId: string): Promise<Account[]> {
        const result = await this.db.query(
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

    public async retrieveSingle(userId: string, accountId: string): Promise<Account | null> {
        const result = await this.db.query(
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

    public async create(userId: string, account: Account): Promise<Account> {
        const now = DateTimeUtil.now();

        const query = `INSERT INTO finance.accounts 
            (id, created_at, updated_at, user_id, institution_id, name, account_category, account_group, account_type, balance, is_hidden, is_manual, is_retirement, hide_from_cashflow)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING 
                id, 
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                user_id AS "userId", 
                institution_id AS "institutionId", 
                name,
                account_category AS "category", 
                account_group AS "group", 
                account_type AS "type", 
                balance, 
                is_hidden AS "isHidden",
                is_manual AS "isManual",
                is_retirement AS "isRetirement",
                hide_from_cashflow AS "hideFromCashflow"`;

        const params = [
            account.id,
            now,
            now,
            userId,
            account.institutionId,
            account.name,
            account.category,
            account.group,
            account.type,
            account.balance,
            account.isHidden,
            account.isManual,
            account.isRetirement,
            account.hideFromCashflow
        ];

        const result = await this.db.query(query, params);
        const row = result.rows[0];
        return {
            ...row,
            balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
        };
    }

    public async update(userId: string, account: Account): Promise<Account | null> {
        const now = DateTimeUtil.now();
        const query = `UPDATE finance.accounts
                        SET 
                            updated_at = $1,
                            institution_id = $2,
                            name = $3,
                            account_category = $4,
                            account_group = $5,
                            account_type = $6,
                            balance = $7,
                            is_hidden = $8,
                            is_manual = $9,
                            is_retirement = $10,
                            hide_from_cashflow = $11
                        WHERE id = $12 AND user_id = $13
                        RETURNING 
                            id, 
                            created_at AS "createdAt",
                            updated_at AS "updatedAt",
                            user_id AS "userId", 
                            institution_id AS "institutionId", 
                            name,
                            account_category AS "category", 
                            account_group AS "group", 
                            account_type AS "type", 
                            balance, 
                            is_hidden AS "isHidden",
                            is_manual AS "isManual",
                            is_retirement AS "isRetirement",
                            hide_from_cashflow AS "hideFromCashflow"`;

        const params = [
            now,
            account.institutionId,
            account.name,
            account.category,
            account.group,
            account.type,
            account.balance,
            account.isHidden,
            account.isManual,
            account.isRetirement,
            account.hideFromCashflow,
            account.id,
            userId
        ];

        const result = await this.db.query(query, params);
        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ...row,
            balance: typeof row.balance === 'string' ? parseFloat(row.balance) : row.balance
        };
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        // delete constraints: If transactions exist etc., PG might throw constraint error. We assume PG takes care of it or cascades.
        const result = await this.db.query(`DELETE FROM finance.accounts WHERE id = $1 AND user_id = $2`, [id, userId]);
        return (result.rowCount ?? 0) > 0;
    }
}