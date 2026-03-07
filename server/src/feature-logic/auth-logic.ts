import { User } from '@shared/types/entities/core/user';

export class AuthLogic {

    async getUser(username: string): Promise<User | undefined> {
        // TODO: validate request and get user from database
        const user = this.getTestUser(username, username);

        return user;
    }

    async getUserByToken(token: string): Promise<User | undefined> {
        // TODO: validate request and get user from database by token
        const user = this.getTestUser(token, token);

        return user;
    }

    private getTestUser(username: string, name: string): User {
        return {
            id: '1',
            username: username,
            name: name
        };
    }
}