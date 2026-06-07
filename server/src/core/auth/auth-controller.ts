import * as bcrypt from 'bcrypt';
import { OperationResult } from '@shared/common/contracts/operation-result';
import { CoreEntityIdPrefix } from '@shared/common/enum';
import { User } from '@shared/common/types/user';
import { ICoreUserData } from '@core/data/user-data';
import { DateTimeUtil, EntityIdUtil, ResultUtil } from '@core/utility';

export class AuthController {
    private readonly saltRounds = 10;

    constructor(private userData: ICoreUserData) {
        this.userData = userData;
    }

    async loginUser(username: string, password?: string): Promise<OperationResult<User>> {
        if (!password) {
            return ResultUtil.userError('Password is required.');
        }

        const userWithPassword = await this.userData.retrieveByUsername(username);
        if (!userWithPassword) {
            return ResultUtil.userError('Invalid username or password.');
        }

        const match = await bcrypt.compare(password, userWithPassword.passwordHash);
        if (match) {
            // Strip passwordHash before returning
            const { passwordHash, ...user } = userWithPassword;
            return ResultUtil.success(user);
        }

        return ResultUtil.userError('Invalid username or password.');
    }

    async createUser(username: string, name: string, password?: string): Promise<OperationResult<User>> {
        if (!password) {
            return ResultUtil.userError('Password is required.');
        }

        const hash = await bcrypt.hash(password, this.saltRounds);

        const newUser: User = {
            id: EntityIdUtil.generate(CoreEntityIdPrefix.User),
            username,
            displayName: name,
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        };

        return ResultUtil.success(await this.userData.create(newUser, hash));
    }

    async changePassword(userId: string, oldPassword?: string, newPassword?: string): Promise<OperationResult<void>> {
        if (!oldPassword || !newPassword) {
            return ResultUtil.userError('Old and new passwords are required.');
        }

        const user = await this.userData.retrieveSingle(userId);
        if (!user) {
            return ResultUtil.userError('User not found.');
        }

        const userWithPassword = await this.userData.retrieveByUsername(user.username);
        if (!userWithPassword) {
            return ResultUtil.userError('User not found.');
        }

        const match = await bcrypt.compare(oldPassword, userWithPassword.passwordHash);
        if (!match) {
            return ResultUtil.userError('Invalid old password.');
        }

        const newHash = await bcrypt.hash(newPassword, this.saltRounds);
        await this.userData.updatePassword(userId, newHash);
        return ResultUtil.success();
    }
}