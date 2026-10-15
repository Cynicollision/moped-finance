import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler } from '@server/routing';
import { SettingsController } from './settings-controller';
import { ISettingsData } from './settings-data';
import { updateSettingsSchema } from './settings-schema';

const domain = 'Settings';

export function createSettingsRouter(logger: IAppLogger, settingsData: ISettingsData) {
    const router = Router();
    const controller = new SettingsController(settingsData);
    const handler = new OperationHandler(logger);

    // GET / - Get Settings
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getSettings' };
        handler.execute(req, res, op, context => {
            return controller.getSettings(context);
        });
    });

    // PUT / - Update Settings (only the ones sent)
    router.put('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateSettings' };
        handler.execute(req, res, op, { body: updateSettingsSchema }, (context, { body }) => {
            return controller.updateSettings(context, body);
        });
    });

    return router;
}
