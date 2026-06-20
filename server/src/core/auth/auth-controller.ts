import * as bcrypt from 'bcrypt';
import { OperationResult } from '@shared/core/contracts';
import { User } from '@shared/core/types';
import { CoreEntityIdPrefix, EntityId } from '@server-core/data';
import { Result } from '@server-core/routing';
import { DateTimeUtil } from '@server-core/utility';
import { IUserData } from './user-data';

export class AuthController {
    private readonly saltRounds = 10;

    constructor(private userData: IUserData) { }

    async loginUser(username: string, password?: string): Promise<OperationResult<User>> {
        if (!password) {
            return Result.userError('Password is required.');
        }

        const userWithPassword = await this.userData.retrieveByUsername(username);
        if (!userWithPassword) {
            return Result.userError('Invalid username or password.');
        }

        const match = await bcrypt.compare(password, userWithPassword.passwordHash);
        if (match) {
            // Strip passwordHash before returning
            const { passwordHash, ...user } = userWithPassword;
            return Result.success(user);
        }

        return Result.userError('Invalid username or password.');
    }

    async createUser(username: string, name: string, password: string): Promise<OperationResult<User>> {
        const existingUser = await this.userData.retrieveByUsername(username);
        if (existingUser) {
            return Result.userError('Username already taken.');
        }

        const hash = await bcrypt.hash(password, this.saltRounds);

        const newUser: User = {
            id: EntityId.generate(CoreEntityIdPrefix.User),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            username,
            displayName: name
        };

        return Result.success(await this.userData.create(newUser, hash));
    }

    async changePassword(userId: string, oldPassword?: string, newPassword?: string): Promise<OperationResult<void>> {
        if (!oldPassword || !newPassword) {
            return Result.userError('Old and new passwords are required.');
        }

        const user = await this.userData.retrieveSingle(userId);
        if (!user) {
            return Result.userError('User not found.');
        }

        const userWithPassword = await this.userData.retrieveByUsername(user.username);
        if (!userWithPassword) {
            return Result.userError('User not found.');
        }

        const match = await bcrypt.compare(oldPassword, userWithPassword.passwordHash);
        if (!match) {
            return Result.userError('Invalid old password.');
        }

        const newHash = await bcrypt.hash(newPassword, this.saltRounds);
        await this.userData.updatePassword(userId, newHash);
        return Result.success();
    }
}