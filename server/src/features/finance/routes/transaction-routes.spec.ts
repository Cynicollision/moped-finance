import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceTransactionsData } from './../data/transactions-data';
import { createTransactionRouter } from './transaction-routes';

describe('Transaction Routes', () => {
    let app: express.Express;
    let mockTransactionsData: jest.Mocked<IFinanceTransactionsData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockTransactionsData = FinanceMockUtil.createMockTransactionsData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createTransactionRouter(mockTransactionsData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/transactions', testUserId);
    });

    xit('placeholder test for Transaction Routes', () => {
        // TODO: fill out tests
    });
});
