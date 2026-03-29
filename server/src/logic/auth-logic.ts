import * as bcrypt from 'bcrypt';
import { User } from '@shared/core/types/user';
import { CoreUserData, ICoreUserData } from './../data-access/core/user-data';
import ShortUniqueId from 'short-unique-id';

export class AuthLogic {
    private userData: ICoreUserData;
    private readonly uid = new ShortUniqueId({ length: 10 });
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
            throw new Error('Password is required.');
        }

        const hash = await bcrypt.hash(password, this.saltRounds);

        const newUser: User = {
            id: this.uid.rnd(),
            name,
            username,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return await this.userData.create(newUser, hash);
    }

    async changePassword(userId: string, oldPassword?: string, newPassword?: string): Promise<void> {
        if (!oldPassword || !newPassword) {
            throw new Error('Old and new passwords are required.');
        }

        const user = await this.userData.retrieveSingle(userId);
        if (!user) {
            throw new Error('User not found.');
        }

        // We need to get the user's password hash from the DB, so we look up by username
        const userWithPassword = await this.userData.retrieveByUsername(user.username);
        if (!userWithPassword) {
            throw new Error('User not found.');
        }

        const match = await bcrypt.compare(oldPassword, userWithPassword.passwordHash);
        if (!match) {
            throw new Error('Invalid old password.');
        }

        const newHash = await bcrypt.hash(newPassword, this.saltRounds);
        await this.userData.updatePassword(userId, newHash);
    }
}