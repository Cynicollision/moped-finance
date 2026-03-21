import ShortUniqueId from 'short-unique-id';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';

const uid = new ShortUniqueId({ length: 16 });

export function generateEntityId(prefix: EntityIdPrefix): string {
    return `${prefix}${uid.rnd()}`;
}
