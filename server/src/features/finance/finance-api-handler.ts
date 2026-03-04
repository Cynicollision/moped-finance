import { Request, Response } from 'express';
import { ApiHandler } from '../../api-handler';
import { FinanceLogic } from './finance-logic';

export class FinanceApiHandler extends ApiHandler {

    constructor(private financeLogic: FinanceLogic) {
        super();
    }

    async getFinanceProfile(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getUser(req);

            if (!user) {
                this.failUnauthorized(res);
                return;
            }
                
            const result = await this.financeLogic.getProfile(user.id);
            this.succeed(res, result);
        }
        catch (error) {
            this.failInternalError(res, error);
        }
    }

    async getAccounts(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getUser(req);

            if (!user) {
                this.failUnauthorized(res);
                return;
            }

            const result = await this.financeLogic.getAccounts(user.id);
            this.succeed(res, result);
        }
        catch (error) {
            this.failInternalError(res, error);
        }
    }

    async getInstitutions(req: Request, res: Response): Promise<void> {
        const user = this.getUser(req);

        if (!user) {
            this.failUnauthorized(res);
            return;
        }

        const result = await this.financeLogic.getInstitutions(user.id);
        this.succeed(res, result);
    }

    async getCategories(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getUser(req);

            if (!user) {
                this.failUnauthorized(res);
                return;
            }

            const result = await this.financeLogic.getCategories(user.id);

            this.succeed(res, result);
        }
        catch (error) {
            this.failInternalError(res, error);
        }
    }

    async getTransaction(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getUser(req);

            if (!user) {
                this.failUnauthorized(res);
                return;
            }

            const sort = req.query.sort as string;
            const direction = req.query.direction as string;
            const offset = parseInt(req.query.offset as string, 10) || 0;
            const limit = parseInt(req.query.limit as string, 10) || 50;

            const result = await this.financeLogic.getTransactions(user.id, { sort, direction, offset, limit });

            this.succeed(res, result);
        }
        catch (error) {
            this.failInternalError(res, error);
        }
    }
}