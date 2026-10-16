import * as bcrypt from 'bcrypt';
import { RegistrationStatus } from '@shared/core/contracts';
import { User } from '@shared/core/types';
import { PasswordRules } from '@shared/core/util';
import { CoreEntityIdPrefix, DbTransaction, EntityId } from '@server/data';
import { OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { IUserData } from './user-data';

/** The default categories (CAT-6.2): `prepare` returns the step that saves them in the registration's transaction. */
export interface IDefaultCategories {
    prepare(): Promise<(tx: DbTransaction) => Promise<void>>;
}

export class AuthController {
    private readonly saltRounds = 10;

    constructor(
        private userData: IUserData,
        private defaultCategories: IDefaultCategories
    ) {}

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

    async getRegistrationStatus(): Promise<OperationResult<RegistrationStatus>> {
        return Result.success({ isOpen: await this.isRegistrationOpen() });
    }

    async createUser(
        username: string,
        name: string,
        password: string,
        defaultCategories: boolean
    ): Promise<OperationResult<User>> {
        // Single-user app: only the first user can register (AUTH-2.7). Two registrations that both get past this
        // check can't both save: users_single_user_idx allows one row, so the second is refused with the same message.
        if (!(await this.isRegistrationOpen())) {
            return Result.userError('Registration is closed.', 'REGISTRATION_CLOSED');
        }

        const passwordProblems = PasswordRules.problems(password, username);
        if (passwordProblems.length > 0) {
            return Result.userError(passwordProblems.join(' '), 'INVALID_PASSWORD');
        }

        const hash = await bcrypt.hash(password, this.saltRounds);

        const newUser: User = {
            id: EntityId.generate(CoreEntityIdPrefix.User),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            username,
            displayName: name
        };

        // The categories are saved with the user, or neither is (AUTH-2.9, CAT-6.2).
        const setUp = defaultCategories ? await this.defaultCategories.prepare() : undefined;
        return Result.success(await this.userData.create(newUser, hash, setUp));
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

        const passwordProblems = PasswordRules.problems(newPassword, user.username);
        if (passwordProblems.length > 0) {
            return Result.userError(passwordProblems.join(' '), 'INVALID_PASSWORD');
        }

        const newHash = await bcrypt.hash(newPassword, this.saltRounds);
        await this.userData.updatePassword(userId, newHash);
        return Result.success();
    }

    async updateProfile(userId: string, displayName: string): Promise<OperationResult<User>> {
        const user = await this.userData.updateDisplayName(userId, displayName);
        if (!user) {
            return Result.userErrorNotFound('User not found.');
        }
        return Result.successUpdated(user);
    }

    private async isRegistrationOpen(): Promise<boolean> {
        return (await this.userData.retrieveCount()) === 0;
    }
}
