import express, { Router } from 'express';
import { AppLogger } from '@server-core/logging';

export class TestExpressUtil {
    /**
     * Creates an Express app configured for testing a specific router.
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
        return app;
    }

    // TODO: replace w/ IAppLogger implementation
    public static createMockLogger(): jest.Mocked<AppLogger> {
        return {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        } as any;
    }
}
