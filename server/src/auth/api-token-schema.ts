import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { API_TOKEN_EXPIRATION_DAYS } from '@shared/core/contracts';
import { ApiTokenAccess } from '@shared/core/enum';
import { apiTokenSchema } from './api-token-data';

// AUTH-11.2
export const createApiTokenSchema = createInsertSchema(apiTokenSchema, {
    name: (schema) => schema.trim().min(1).max(100),
    access: z.enum(ApiTokenAccess),
}).pick({
    name: true,
    access: true,
}).extend({
    expiresInDays: z.union(API_TOKEN_EXPIRATION_DAYS.map(days => z.literal(days))).nullable(),
});

export type CreateApiTokenInput = z.output<typeof createApiTokenSchema>;
