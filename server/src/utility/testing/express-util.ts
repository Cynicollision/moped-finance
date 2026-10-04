import express, { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { buildErrorHandler } from '@server/routing';

export class TestExpressUtil {
    /**
     * Creates an Express app configured for testing a specific router, with the app's error handler.
     * Injects a mock user into the request to simulate the auth middleware.
     */
    public static createTestApp(router: Router, routePath: string, mockUserId: string = 'test-user-id'): express.Express {
        const app = express();
        app.use(express.json());

        // Mock authentication middleware
        app.use((req, res, next) => {
            (req as any).user = { id: mockUserId };
            next();
        });

        app.use(routePath, router);
        app.use(buildErrorHandler(TestExpressUtil.createMockLogger()));
        return app;
    }

    public static createMockLogger(): jest.Mocked<IAppLogger> {
        return {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };
    }
}
