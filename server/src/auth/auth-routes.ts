import { Router} from 'express';
import { AuthLogic } from './auth-logic';
import { AuthApiHandler } from './auth-api-handler';

const router = Router();
const authLogic = new AuthLogic();
const apiHandler = new AuthApiHandler(authLogic);

router.post('/login', apiHandler.login.bind(apiHandler));
router.post('/logout', apiHandler.logout.bind(apiHandler));
router.get('/me', apiHandler.checkSession.bind(apiHandler));

export default router;