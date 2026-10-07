import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { asOfDateQuerySchema, idParamsSchema, OperationDefinition, OperationHandler } from '@server/routing';
import { IFinanceAccountData } from './../accounts';
import { InstitutionController } from './institution-controller';
import { IFinanceInstitutionData } from './institution-data';
import { createInstitutionSchema, updateInstitutionSchema } from './institution-schema';

const domain = 'Institution';

export function createInstitutionRouter(
    logger: IAppLogger,
    institutionsData: IFinanceInstitutionData,
    accountData: IFinanceAccountData
) {
    const router = Router();
    const controller = new InstitutionController(logger, institutionsData, accountData);
    const handler = new OperationHandler(logger);

    // GET / - Get Institutions
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitutions' };
        handler.execute(req, res, op, context => {
            return controller.getInstitutions(context);
        });
    });

    // GET /:id - Get Institution
    router.get('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitution' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getInstitution(context, params.id);
        });
    });

    // GET /:id/accounts - Get Institution Accounts
    router.get('/:id/accounts', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitutionAccounts' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: asOfDateQuerySchema },
            (context, { params, query }) => {
                return controller.getInstitutionAccounts(context, params.id, query.asOfDate);
            }
        );
    });

    // POST / - Create Institution
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createInstitution' };
        handler.execute(req, res, op, { body: createInstitutionSchema }, (context, { body }) => {
            return controller.createInstitution(context, body);
        });
    });

    // PUT /:id - Update Institution
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateInstitution' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateInstitutionSchema },
            (context, { params, body }) => {
                return controller.updateInstitution(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Institution
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteInstitution' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteInstitution(context, params.id);
        });
    });

    // POST /:id/sync - Sync Institution
    router.post('/:id/sync', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncInstitution' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.syncInstitution(context, params.id);
        });
    });

    return router;
}
