// Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';

const uniqueViolationMessages: Record<string, string> = {
    users_username_unique: 'Username already taken.',
    institutions_name_unique_idx: 'An institution with that name already exists.',
    category_groups_name_unique_idx: 'A category group with that name already exists.',
    categories_name_unique_idx: 'A category with that name already exists.',
    balance_history_account_id_date_unique: 'An account can only have one balance per date.',
};

export class DatabaseErrorUtil {

    /**
     * Returns a user-facing message if the error is a unique-constraint violation, otherwise undefined.
     * Drizzle wraps driver errors, so the Postgres error may be the error itself or its `cause`.
     */
    public static getUniqueViolationMessage(error: unknown): string | undefined {
        const pgError = DatabaseErrorUtil.findPostgresError(error);
        if (pgError?.code !== UNIQUE_VIOLATION) {
            return undefined;
        }

        return uniqueViolationMessages[pgError.constraint ?? ''] ?? 'A record with those values already exists.';
    }

    private static findPostgresError(error: unknown): { code?: string, constraint?: string } | undefined {
        let current: any = error;
        while (current) {
            if (typeof current.code === 'string') {
                return current;
            }
            current = current.cause;
        }
        return undefined;
    }
}
