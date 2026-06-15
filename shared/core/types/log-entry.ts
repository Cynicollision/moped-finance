import { Entity } from './entity-base';

export type LogEntry = Entity & {
    contextUserId: string;
    level: string;
    context: string;
    message: string;
}