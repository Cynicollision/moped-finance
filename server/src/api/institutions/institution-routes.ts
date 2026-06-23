import { Router } from 'express';
import { Institution } from '@shared/finance/types';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server/routing';
import { IFinanceAccountData } from './../accounts';
import { InstitutionController } from './institution-controller';
import { IFinanceInstitutionData } from './institution-data';
import { createInstitutionSchema, updateInstitutionSchema } from './institution-schema';

const domain = 'Institution';

export function createInstitutionRouter(logger: IAppLogger, institutionsData: IFinanceInstitutionData, accountData: IFinanceAccountData) {
    const router = Router();
    const controller = new InstitutionController(logger, institutionsData, accountData);
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Institution');

    // GET / - Get Institutions
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitutions' };
        handler.execute(req, res, op, (context) => {
            return controller.getInstitutions(context);
        });
    });

    // GET /:id - Get Institution
    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.getInstitution(context, req.params.id);
        });
    });

    // GET /:id/accounts - Get Institution Accounts
    router.get('/:id/accounts', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitutionAccounts' };
        handler.execute(req, res, op, (context) => {
            return controller.getInstitutionAccounts(context, req.params.id);
        });
    });

    // POST / - Create Institution
    router.post('/', validator.body(createInstitutionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.createInstitution(context, req.body);
        });
    });

    // PUT /:id - Update Institution
    router.put('/:id', validator.id(), validator.body(updateInstitutionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateInstitution' };
        handler.execute(req, res, op, (context) => {
            const institution: Institution = req.body;
            institution.id = req.params.id;
            return controller.updateInstitution(context, institution);
        });
    });

    // DELETE /:id - Delete Institution
    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteInstitution(context, req.params.id);
        });
    });

    // POST /:id/sync - Sync Institution
    router.post('/:id/sync', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.syncInstitution(context, req.params.id);
        });
    });

    return router;
}
