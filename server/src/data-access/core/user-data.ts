import { User } from '@shared/core/types/user';
import { DateTimeUtil } from './../../utility/date-time';
import { databasePool } from './../db-client';

export interface UserWithPassword extends User {
    passwordHash: string;
}

export interface ICoreUserData {
    create(user: User, passwordHash: string): Promise<User>;
    retrieveSingle(id: string): Promise<User | null>;
    retrieveByUsername(username: string): Promise<UserWithPassword | null>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
}

export class CoreUserData implements ICoreUserData {

    public async create(user: User, passwordHash: string): Promise<User> {
        const now = DateTimeUtil.now();

        const query = `INSERT INTO core.users 
            (id, created_at, updated_at, username, name, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING 
                id, 
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                username,
                name`;

        const params = [
            user.id,
            now,
            now,
            user.username,
            user.name,
            passwordHash
        ];

        const result = await databasePool.query(query, params);
        return result.rows[0];
    }

    public async retrieveSingle(id: string): Promise<User | null> {
        const result = await databasePool.query(
            `SELECT 
                id, 
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                username,
                name
            FROM core.users 
            WHERE id = $1`,
            [id]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    }

    public async retrieveByUsername(username: string): Promise<UserWithPassword | null> {
        const result = await databasePool.query(
            `SELECT 
                id, 
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                username,
                password_hash AS "passwordHash",
                name
            FROM core.users 
            WHERE username = $1`,
            [username]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    }

    public async updatePassword(id: string, passwordHash: string): Promise<void> {
        const now = DateTimeUtil.now();
        const query = `UPDATE core.users
                        SET 
                            updated_at = $1,
                            password_hash = $2
                        WHERE id = $3`;

        const result = await databasePool.query(query, [now, passwordHash, id]);
        if (result.rowCount === 0) {
            throw new Error('User not found.');
        }
    }
}
