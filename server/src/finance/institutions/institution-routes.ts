import { Router } from 'express';
import { ApiHandler } from '@server-core/api-handler';
import { AppLogger } from '@server-core/logger';
import { RequestSchemaValidator } from '@server-core/validation';
import { InstitutionController } from './institution-controller';
import { IFinanceInstitutionsData } from './institution-data';
import { createInstitutionSchema, updateInstitutionSchema } from './institution-schema';

export function createInstitutionRouter(logger: AppLogger, institutionsData: IFinanceInstitutionsData) {
    const router = Router();
    const controller = new InstitutionController(logger, institutionsData);
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Institution');

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getInstitutions', (context) => {
            return controller.getInstitutions(context.userId!);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'getInstitution', (context) => {
            return controller.getInstitution(context.userId!, req.params.id);
        });
    });

    router.post('/', validator.body(createInstitutionSchema), (req, res) => {
        handler.execute(req, res, 'createInstitution', (context) => {
            return controller.createInstitution(context.userId!, req.body);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateInstitutionSchema), (req, res) => {
        handler.execute(req, res, 'updateInstitution', (context) => {
            const institution = { ...req.body, id: req.params.id };
            return controller.updateInstitution(context.userId!, institution);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'deleteInstitution', (context) => {
            return controller.deleteInstitution(context.userId!, req.params.id);
        });
    });

    router.post('/:id/sync', validator.id(), (req, res) => {
        handler.execute(req, res, 'syncInstitution', (context) => {
            return controller.syncInstitution(context.userId!, req.params.id);
        });
    });

    return router;
}
