import { User } from '@shared/core/types';
import { PasswordRules } from '@shared/core/util';
import { PasswordHash } from './password-hash';
import { IUserData } from './user-data';

/** Setting a new password for a forgotten one, from the host (AUTH-12). The `reset-password` command drives it. */
export class PasswordReset {
    constructor(private readonly userData: IUserData) {}

    /** The instance's one user (AUTH-7.2), or null while registration is still open. */
    public owner(): Promise<User | null> {
        return this.userData.retrieveOwner();
    }

    /** Why the new password can't be saved (AUTH-12.3), or nothing if it can. */
    public problems(user: User, newPassword: string, confirmation: string): string[] {
        if (newPassword !== confirmation) {
            return ['Passwords do not match.'];
        }
        return PasswordRules.problems(newPassword, user.username);
    }

    /** Saves the new password and signs out every session (AUTH-12.4). Check `problems` first. */
    public async reset(user: User, newPassword: string): Promise<void> {
        await this.userData.updatePassword(user.id, await PasswordHash.create(newPassword));
    }
}
