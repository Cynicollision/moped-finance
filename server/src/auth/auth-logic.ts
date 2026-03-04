import { User } from '@shared/types/core/entities/user';

export interface AuthRequest {
  username: string;
  password?: string;
}

export class AuthLogic {
    
  public async login(username: string): Promise<User> {
    // TODO: Hardcoded user for now
    const user: User = {
      id: '1',
      username: username,
      name: username
    };

    return user;
  }
}