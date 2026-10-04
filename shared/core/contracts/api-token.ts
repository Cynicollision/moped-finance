import { ApiTokenAccess } from '../enum/api-token-access';
import { ApiToken } from '../types/api-token';

export interface CreateApiTokenRequest {
    name: string;
    access: ApiTokenAccess;
    /** One of API_TOKEN_EXPIRATION_DAYS, or null for no expiration. */
    expiresInDays: number | null;
}

/** The choices New Token offers (AUTH-11.2). */
export const API_TOKEN_EXPIRATION_DAYS = [30, 90, 365] as const;

export interface CreatedApiToken {
    apiToken: ApiToken;
    /** The token itself. Shown once; the server keeps only its hash. */
    token: string;
}
