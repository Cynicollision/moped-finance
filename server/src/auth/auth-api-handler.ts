import { Request, Response } from 'express';
import { AuthLogic, AuthRequest } from './auth-logic';
import { ApiHandler } from './../api-handler';

export class AuthApiHandler extends ApiHandler {

  constructor(private authLogic: AuthLogic) {
      super();
  }

  async login(req: Request, res: Response): Promise<void> {
      // TODO: cleanup type usage
      const { username } = req.body as AuthRequest;

      const user = await this.authLogic.login(username);
      req.session.user = user;

      return this.succeed(res, user);
  }

  async logout(req: Request, res: Response): Promise<void> {
      req.session.destroy((err) => {
          if (err) {
              return this.failInternalError(res, 'Could not log out.');
          }
          res.clearCookie('connect.sid');
          this.succeed(res);
    });
}

  async checkSession(req: Request, res: Response): Promise<void> {
      const user = req.session.user;

      if (!user) {
          // TODO: is 401 correct here? Or 200 w/ success = false for more graceful handling on client?
          this.failUnauthorized(res);
          return;
      }

      //res.json(OperationResultFactory.success(user));
      this.succeed(res, user);
  }

}