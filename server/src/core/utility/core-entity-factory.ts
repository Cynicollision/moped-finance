import ShortUniqueId from 'short-unique-id';
import { Entity, NewEntity } from '@shared/core/types';
import { User, LogEntry } from '@shared/core/types';
import { DateTimeUtil } from './date-time-util';

export enum CoreEntityIdPrefix {
    User = '01',
    LogEntry = '02'
}

const uid = new ShortUniqueId({ length: 16 });

export class CoreEntityFactory {

    // TODO: only used in seed script. Try to remove.
    public static generateId(prefix: string): string {
        return `${prefix}${uid.rnd()}`;
    }

    public static createEntity<T extends Entity>(prefix: string, newEntity: NewEntity<T>): T {
        return {
            ...newEntity,
            id: newEntity.id || CoreEntityFactory.generateId(prefix),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now()
        } as unknown as T;
    }

    public static createUser(user: NewEntity<User>): User {
        return CoreEntityFactory.createEntity<User>(CoreEntityIdPrefix.User, user);
    }

    public static createLogEntry(logEntry: NewEntity<LogEntry>): LogEntry {
        return CoreEntityFactory.createEntity<LogEntry>(CoreEntityIdPrefix.LogEntry, logEntry);
    }
}
