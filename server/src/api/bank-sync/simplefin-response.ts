import { z } from 'zod';

/**
 * What one `GET /accounts` returned, in our own shape whichever protocol version Bridge answered in. Plain JSON
 * (timestamps stay Unix seconds), so a sync can store it on its run and linking can read it back (SYNC-2.10).
 */
export interface SimplefinAccountSet {
    connections: SimplefinConnection[];
    accounts: SimplefinAccount[];
    /** Bridge's messages, as it wrote them (SYNC-5.2), in the order it gave them. */
    messages: SimplefinMessage[];
}

/** One sign-in at one bank. v1 has no connections, so each account's `org` stands in for one. */
export interface SimplefinConnection {
    id: string;
    name: string;
    orgId: string | null;
    orgName: string | null;
    orgUrl: string | null;
}

export interface SimplefinAccount {
    /** Unique within its connection only. */
    id: string;
    connectionId: string;
    name: string;
    /** An ISO 4217 code such as USD, or a URL for a custom currency. */
    currency: string;
    balance: number;
    availableBalance: number | null;
    /** Unix seconds. */
    balanceDate: number;
    transactions: SimplefinTransaction[];
}

export interface SimplefinTransaction {
    /** Unique within its account only. */
    id: string;
    /** Unix seconds; 0 when it hasn't posted yet. */
    posted: number;
    /** Money in is positive. */
    amount: number;
    description: string;
    /** Trimmed; null when Bridge gives none or a blank one. */
    payee: string | null;
    memo: string | null;
    /** Unix seconds; when the bank says it happened, if it says. */
    transactedAt: number | null;
    pending: boolean;
}

export interface SimplefinMessage {
    /** `errlist`'s code (`gen.*`, `con.*`, `act.*`); null for v1's `errors` and `x-api-message`. */
    code: string | null;
    text: string;
    connectionId: string | null;
    accountId: string | null;
}

// Amounts are numeric strings ("-105.50"). Number() alone would also accept "", "0x10" and "1e3".
const amount = z
    .string()
    .regex(/^[+-]?\d+(\.\d+)?$/)
    .transform(Number);
const timestamp = z.number().int().nonnegative();
const optionalText = z
    .string()
    .nullish()
    .transform(text => text?.trim() || null);

const transactionSchema = z.object({
    id: z.string().min(1),
    posted: timestamp,
    amount,
    description: z.string(),
    payee: optionalText,
    memo: optionalText,
    transacted_at: timestamp.nullish(),
    pending: z.boolean().nullish()
});

const accountFields = {
    id: z.string().min(1),
    name: z.string(),
    currency: z.string().min(1),
    balance: amount,
    'available-balance': amount.nullish(),
    'balance-date': timestamp,
    transactions: z.array(transactionSchema).nullish()
};

const messageSchema = z.object({
    code: z.string(),
    msg: z.string(),
    conn_id: z.string().nullish(),
    account_id: z.string().nullish()
});

const extraMessages = {
    errors: z.array(z.string()).nullish(),
    'x-api-message': z.array(z.string()).nullish()
};

const v2Schema = z.object({
    errlist: z.array(messageSchema),
    connections: z.array(
        z.object({
            conn_id: z.string().min(1),
            name: z.string(),
            org_id: z.string().nullish(),
            org_name: z.string().nullish(),
            org_url: z.string().nullish()
        })
    ),
    accounts: z.array(z.object({ ...accountFields, conn_id: z.string().min(1) })),
    ...extraMessages
});

const v1Schema = z.object({
    accounts: z.array(
        z.object({
            ...accountFields,
            org: z.object({
                id: z.string().nullish(),
                name: z.string().nullish(),
                domain: z.string().nullish(),
                url: z.string().nullish(),
                'sfin-url': z.string()
            })
        })
    ),
    ...extraMessages
});

type ParsedAccount = z.output<z.ZodObject<typeof accountFields>>;

/** Reads the body of `GET /accounts`, v2 or v1. Returns null when it's neither, rather than guessing. */
export function parseAccountSet(body: unknown): SimplefinAccountSet | null {
    const v2 = v2Schema.safeParse(body);
    if (v2.success) {
        const { errlist, connections, accounts } = v2.data;
        return {
            connections: connections.map(connection => ({
                id: connection.conn_id,
                name: connection.name,
                orgId: connection.org_id ?? null,
                orgName: connection.org_name ?? null,
                orgUrl: connection.org_url ?? null
            })),
            accounts: accounts.map(account => toAccount(account, account.conn_id)),
            messages: [
                ...errlist.map(message => ({
                    code: message.code,
                    text: message.msg,
                    connectionId: message.conn_id ?? null,
                    accountId: message.account_id ?? null
                })),
                ...plainMessages(v2.data)
            ]
        };
    }

    // Bridge answers in v1 when a request doesn't ask for v2.
    const v1 = v1Schema.safeParse(body);
    if (v1.success) {
        const connections = new Map<string, SimplefinConnection>();
        const accounts = v1.data.accounts.map(account => {
            const { org } = account;
            const id = org.id || org['sfin-url'];
            if (!connections.has(id)) {
                connections.set(id, {
                    id,
                    name: org.name || org.domain || id,
                    orgId: org.id ?? null,
                    orgName: org.name ?? null,
                    orgUrl: org.url ?? null
                });
            }
            return toAccount(account, id);
        });
        return { connections: [...connections.values()], accounts, messages: plainMessages(v1.data) };
    }

    return null;
}

function toAccount(account: ParsedAccount, connectionId: string): SimplefinAccount {
    return {
        id: account.id,
        connectionId,
        name: account.name,
        currency: account.currency,
        balance: account.balance,
        availableBalance: account['available-balance'] ?? null,
        balanceDate: account['balance-date'],
        transactions: (account.transactions ?? []).map(transaction => ({
            id: transaction.id,
            posted: transaction.posted,
            amount: transaction.amount,
            description: transaction.description,
            payee: transaction.payee,
            memo: transaction.memo,
            transactedAt: transaction.transacted_at ?? null,
            pending: transaction.pending ?? false
        }))
    };
}

function plainMessages(body: { errors?: string[] | null; 'x-api-message'?: string[] | null }): SimplefinMessage[] {
    return [...(body.errors ?? []), ...(body['x-api-message'] ?? [])].map(text => ({
        code: null,
        text,
        connectionId: null,
        accountId: null
    }));
}
