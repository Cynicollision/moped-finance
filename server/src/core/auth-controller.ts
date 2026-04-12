import * as bcrypt from 'bcrypt';
import { EntityIdPrefix } from '@shared/core/enum';
import { User } from '@shared/core/types/user';
import { DateTimeUtil } from './../utility/date-time';
import { EntityIdUtil } from './../utility/entity-id';
import { BadRequestError } from './../utility/errors';
import { CoreUserData, ICoreUserData } from './data/user-data';

export class AuthController {
    private userData: ICoreUserData;
    private readonly saltRounds = 10;

    constructor() {
        this.userData = new CoreUserData();
    }

    async loginUser(username: string, password?: string): Promise<User | undefined> {
        if (!password) {
            return undefined;
        }

        const userWithPassword = await this.userData.retrieveByUsername(username);
        if (!userWithPassword) {
            return undefined;
        }

        const match = await bcrypt.compare(password, userWithPassword.passwordHash);
        if (match) {
            // Strip passwordHash before returning
            const { passwordHash, ...user } = userWithPassword;
            return user;
        }

        return undefined;
    }

    async createUser(username: string, name: string, password?: string): Promise<User> {
        if (!password) {
            throw new BadRequestError('Password is required.');
        }

        const hash = await bcrypt.hash(password, this.saltRounds);

        const newUser: User = {
            id: EntityIdUtil.generate(EntityIdPrefix.User),
            username,
            displayName: name,
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        };

        return await this.userData.create(newUser, hash);
    }

    async changePassword(userId: string, oldPassword?: string, newPassword?: string): Promise<void> {
        if (!oldPassword || !newPassword) {
            throw new BadRequestError('Old and new passwords are required.');
        }

        const user = await this.userData.retrieveSingle(userId);
        if (!user) {
            throw new BadRequestError('User not found.');
        }

        const userWithPassword = await this.userData.retrieveByUsername(user.username);
        if (!userWithPassword) {
            throw new BadRequestError('User not found.');
        }

        const match = await bcrypt.compare(oldPassword, userWithPassword.passwordHash);
        if (!match) {
            throw new BadRequestError('Invalid old password.');
        }

        const newHash = await bcrypt.hash(newPassword, this.saltRounds);
        await this.userData.updatePassword(userId, newHash);
    }
}