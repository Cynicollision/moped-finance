import { createHash, randomBytes } from 'crypto';
import { CreatedApiToken } from '@shared/core/contracts';
import { ApiToken } from '@shared/core/types';
import { CoreEntityIdPrefix, EntityId } from '@server/data';
import { OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { ApiTokenGrant, IApiTokenData } from './api-token-data';
import { CreateApiTokenInput } from './api-token-schema';

const TOKEN_PREFIX = 'mf_';
const DAY_MS = 24 * 60 * 60 * 1000;

export class ApiTokenController {
    constructor(private apiTokenData: IApiTokenData) {}

    async retrieveAll(): Promise<OperationResult<ApiToken[]>> {
        return Result.success(await this.apiTokenData.retrieveAll());
    }

    async create(userId: string, input: CreateApiTokenInput): Promise<OperationResult<CreatedApiToken>> {
        // AUTH-11.4: 32 random bytes. The token is only returned here; the database gets its hash (AUTH-11.3).
        const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
        const now = DateTimeUtil.now();

        const apiToken = await this.apiTokenData.insert({
            id: EntityId.generate(CoreEntityIdPrefix.ApiToken),
            createdAt: now,
            userId,
            name: input.name,
            access: input.access,
            tokenHash: ApiTokenController.hash(token),
            lastUsedAt: null,
            expiresAt:
                input.expiresInDays === null ? null : DateTimeUtil.addMilliseconds(now, input.expiresInDays * DAY_MS)
        });

        return Result.successCreated({ apiToken, token });
    }

    async revoke(id: string): Promise<OperationResult<void>> {
        const deleted = await this.apiTokenData.delete(id);
        return deleted ? Result.successDeleted() : Result.userErrorNotFound('API token not found.');
    }

    /** The owner and access of a valid token, or null if it's unknown, revoked or expired (AUTH-11.7). */
    async authenticate(token: string): Promise<ApiTokenGrant | null> {
        if (!token.startsWith(TOKEN_PREFIX)) {
            return null;
        }

        const grant = await this.apiTokenData.retrieveValidByHash(ApiTokenController.hash(token));
        if (grant) {
            await this.apiTokenData.recordUse(grant.tokenId);
        }
        return grant;
    }

    // A fast hash is enough: unlike a password, the token is 256 random bits, so it can't be guessed.
    private static hash(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
