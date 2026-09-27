import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { idParamsSchema, OperationDefinition, OperationHandler } from '@server/routing';
import { ApiTokenController } from './api-token-controller';
import { createApiTokenSchema } from './api-token-schema';
import { AuthMiddleware } from './auth-middleware';

/**
 * Managing API tokens (AUTH-11). Mounted at /auth/tokens and needs a browser session: a token can't be used to
 * create or revoke tokens (AUTH-11.9).
 */
export function buildApiTokenRouter(logger: IAppLogger, controller: ApiTokenController, middleware: AuthMiddleware): Router {
    const domain = 'ApiToken';
    const handler = new OperationHandler(logger);
    const router = Router();

    router.use(middleware.requireSession);

    // GET / - List tokens, newest first
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'retrieveAll' };
        handler.execute(req, res, op, async () => {
            return await controller.retrieveAll();
        });
    });

    // POST / - Create a token; the response is the only time the token itself is returned
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'create' };
        handler.execute(req, res, op, { body: createApiTokenSchema }, async (context, { body }) => {
            return await controller.create(context.user.getId(), body);
        });
    });

    // DELETE /:id - Revoke a token
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'revoke' };
        handler.execute(req, res, op, { params: idParamsSchema }, async (_context, { params }) => {
            return await controller.revoke(params.id);
        });
    });

    return router;
}
