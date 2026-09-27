import { ApiTokenAccess } from '../enum/api-token-access';

// A personal API token (AUTH-11). The token itself is only returned once, when it's created (CreatedApiToken).
export type ApiToken = {
    id: string;
    createdAt: Date;
    name: string;
    access: ApiTokenAccess;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
};
