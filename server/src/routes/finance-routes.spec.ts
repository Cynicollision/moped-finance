import express from 'express';
import request from 'supertest';
import { createFinanceRouter } from './finance-routes';
import { IFinanceData } from '../features/finance/data';
import { AppLogger } from '../core/logger';

describe('Finance Routes', () => {
    let app: express.Express;
    let mockFinanceData: jest.Mocked<IFinanceData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        // Create a mock structure for IFinanceData
        mockFinanceData = {
            accounts: {
                retrieveAll: jest.fn(),
                retrieveSingle: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            },
            balanceHistory: {
                retrieveForAccount: jest.fn(),
                retrieveSumByDate: jest.fn()
            },
            budgetStream: {
                retrieveAll: jest.fn(),
                insert: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            },
            categories: {
                retrieveAll: jest.fn()
            },
            institutions: {
                retrieveAll: jest.fn()
            },
            transactions: {
                retrieveSingle: jest.fn(),
                search: jest.fn(),
                retrieveMerchants: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                retrieveSpendingByCategory: jest.fn()
            }
        } as any;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        } as any;

        app = express();
        app.use(express.json());

        // Middleware to simulate an authenticated user
        app.use((req, res, next) => {
            (req as any).user = { id: testUserId };
            next();
        });

        // Inject the mocked dependencies into the router
        app.use('/finance', createFinanceRouter(mockFinanceData, mockLogger));
    });

    describe('GET /finance/data/accounts', () => {
        it('should return a list of accounts when successful', async () => {
            const mockAccounts = [
                { id: 'acc1', name: 'Checking', userId: testUserId },
                { id: 'acc2', name: 'Savings', userId: testUserId }
            ];
            (mockFinanceData.accounts.retrieveAll as jest.Mock).mockResolvedValue(mockAccounts);

            const response = await request(app).get('/finance/data/accounts');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockAccounts);
            expect(mockFinanceData.accounts.retrieveAll).toHaveBeenCalledWith(testUserId);
        });

        it('should return 500 when an internal error occurs', async () => {
            (mockFinanceData.accounts.retrieveAll as jest.Mock).mockRejectedValue(new Error('DB Error'));

            const response = await request(app).get('/finance/data/accounts');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBeDefined();
        });
    });

    describe('GET /finance/data/accounts/:accountId', () => {
        it('should return a single account when found', async () => {
            const mockAccount = { id: 'acc1', name: 'Checking', userId: testUserId };
            (mockFinanceData.accounts.retrieveSingle as jest.Mock).mockResolvedValue(mockAccount);

            const response = await request(app).get('/finance/data/accounts/acc1');

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(mockAccount);
            expect(mockFinanceData.accounts.retrieveSingle).toHaveBeenCalledWith(testUserId, 'acc1');
        });

        it('should return 400 when account is not found', async () => {
            (mockFinanceData.accounts.retrieveSingle as jest.Mock).mockResolvedValue(null);

            const response = await request(app).get('/finance/data/accounts/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /finance/data/accounts', () => {
        it('should create a new account', async () => {
            const newAccount = { name: 'New Account', institutionId: 'inst1' };
            const createdAccount = { ...newAccount, id: 'new-acc-id', userId: testUserId };
            (mockFinanceData.accounts.create as jest.Mock).mockResolvedValue(createdAccount);

            const response = await request(app)
                .post('/finance/data/accounts')
                .send(newAccount);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(createdAccount);
            expect(mockFinanceData.accounts.create).toHaveBeenCalledWith(testUserId, expect.objectContaining(newAccount));
        });
    });
});
