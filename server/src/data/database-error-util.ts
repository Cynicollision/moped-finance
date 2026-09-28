// Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const RESTRICT_VIOLATION = '23001';

const uniqueViolationMessages: Record<string, string> = {
    users_username_unique: 'Username already taken.',
    api_tokens_token_hash_unique_idx: 'That API token already exists.',
    institutions_name_unique_idx: 'An institution with that name already exists.',
    category_groups_name_unique_idx: 'A category group with that name already exists.',
    categories_name_unique_idx: 'A category with that name already exists.',
    balance_history_account_id_date_unique: 'An account can only have one balance per date.',
};

// A foreign key fails in one of two directions, with the same constraint name:
// - missingReference: an insert or update points at a row that doesn't exist (23503).
// - stillReferenced: a delete would orphan rows that point at this one. ON DELETE RESTRICT raises 23001;
//   NO ACTION (the default) raises 23503 with 'is still referenced' in the detail.
// Keys that cascade or set null on delete only need missingReference.
type ForeignKeyMessages = { missingReference: string, stillReferenced?: string };

const foreignKeyViolationMessages: Record<string, ForeignKeyMessages> = {
    api_tokens_user_id_users_id_fk: {
        missingReference: 'User not found.',
    },
    accounts_institution_id_institutions_id_fk: {
        missingReference: 'Institution not found.',
        stillReferenced: 'Cannot delete an institution that still has accounts.',
    },
    balance_history_account_id_accounts_id_fk: {
        missingReference: 'Account not found.',
    },
    categories_group_id_category_groups_id_fk: {
        missingReference: 'Category group not found.',
        stillReferenced: 'Cannot delete a category group that still has categories.',
    },
    transactions_account_id_accounts_id_fk: {
        missingReference: 'Account not found.',
    },
    transactions_category_id_categories_id_fk: {
        missingReference: 'Category not found.',
    },
    transactions_split_parent_id_transactions_id_fk: {
        missingReference: 'Split parent transaction not found.',
        stillReferenced: 'Cannot delete a transaction that has split transactions.',
    },
    budget_streams_category_id_categories_id_fk: {
        missingReference: 'Category not found.',
        stillReferenced: 'This category is used in a budget stream, which must be deleted or assigned to a different category first.',
    },
};

const genericForeignKeyMessage = 'The request refers to a record that does not exist, or the record is still in use.';

export interface ConstraintViolation {
    code: 'ALREADY_EXISTS' | 'INVALID_REFERENCE' | 'IN_USE';
    message: string;
}

interface PostgresError {
    code?: string;
    constraint?: string;
    detail?: string;
}

export class DatabaseErrorUtil {

    /**
     * Returns a user-facing error if the error is a unique, foreign-key or restrict violation, otherwise undefined.
     * The message comes from the tables above, never from the database error itself.
     */
    public static getConstraintViolation(error: unknown): ConstraintViolation | undefined {
        const pgError = DatabaseErrorUtil.findPostgresError(error);
        const constraint = pgError?.constraint ?? '';

        if (pgError?.code === UNIQUE_VIOLATION) {
            return {
                code: 'ALREADY_EXISTS',
                message: uniqueViolationMessages[constraint] ?? 'A record with those values already exists.'
            };
        }

        if (pgError?.code === RESTRICT_VIOLATION) {
            return { code: 'IN_USE', message: foreignKeyViolationMessages[constraint]?.stillReferenced ?? genericForeignKeyMessage };
        }

        if (pgError?.code === FOREIGN_KEY_VIOLATION) {
            return DatabaseErrorUtil.getForeignKeyViolation(pgError);
        }

        return undefined;
    }

    private static getForeignKeyViolation(pgError: PostgresError): ConstraintViolation {
        // The direction is only in the detail text: 'Key (...)=(...) is not present in table "..."'
        // versus 'Key (...)=(...) is still referenced from table "..."'. Postgres localizes that text,
        // so anything unrecognized gets the generic message.
        const detail = pgError.detail ?? '';
        const messages = foreignKeyViolationMessages[pgError.constraint ?? ''];

        if (detail.includes('is still referenced')) {
            return { code: 'IN_USE', message: messages?.stillReferenced ?? genericForeignKeyMessage };
        }

        if (detail.includes('is not present')) {
            return { code: 'INVALID_REFERENCE', message: messages?.missingReference ?? genericForeignKeyMessage };
        }

        return { code: 'INVALID_REFERENCE', message: genericForeignKeyMessage };
    }

    // Drizzle wraps driver errors, so the Postgres error may be the error itself or its `cause`.
    private static findPostgresError(error: unknown): PostgresError | undefined {
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
