import { OperationResult } from "@shared/types/common/operation-response";
import { User } from "@shared/types/core/entities/user";
import { OperationResultFactory } from "./../utility/operation-result-factory";


export interface AuthRequest {
  username: string;
  password?: string;
}

export class AuthLogic {
    
  public async login(username: string): Promise<OperationResult<User>> {
    // TODO: Hardcoded user for now
    const user: User = {
      id: '1',
      username: username,
      name: username
    };

    return OperationResultFactory.success(user);
  }
}