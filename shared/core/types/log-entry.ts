import { Entity } from './entity-base';

export type LogEntry = Entity & {
    userId: string;
    level: string;
    context: string;
    message: string;
}