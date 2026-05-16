import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { InstitutionController } from './../controllers/institution-controller';
import { IFinanceInstitutionsData } from './../data/institutions-data';

export function createInstitutionRouter(
    institutionsData: IFinanceInstitutionsData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new InstitutionController(logger, institutionsData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getInstitutions', (context) => {
            return controller.getInstitutions(context.userId!);
        });
    });

    return router;
}
