import { Router } from 'express';
import { Institution } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { OperationDefinition, OperationHandler } from '@server-core/operation-handler';
import { RequestSchemaValidator } from '@server-core/validation';
import { InstitutionController } from './institution-controller';
import { IFinanceInstitutionData } from './institution-data';
import { createInstitutionSchema, updateInstitutionSchema } from './institution-schema';

const domain = 'Institution';

export function createInstitutionRouter(logger: IAppLogger, institutionsData: IFinanceInstitutionData) {
    const router = Router();
    const controller = new InstitutionController(logger, institutionsData);
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Institution');

    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitutions' };
        handler.execute(req, res, op, (context) => {
            return controller.getInstitutions(context);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.getInstitution(context, req.params.id);
        });
    });

    router.post('/', validator.body(createInstitutionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.createInstitution(context, req.body);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateInstitutionSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateInstitution' };
        handler.execute(req, res, op, (context) => {
            const institution: Institution = req.body;
            institution.id = req.params.id;
            return controller.updateInstitution(context, institution);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteInstitution(context, req.params.id);
        });
    });

    router.post('/:id/sync', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'syncInstitution' };
        handler.execute(req, res, op, (context) => {
            return controller.syncInstitution(context, req.params.id);
        });
    });

    return router;
}
