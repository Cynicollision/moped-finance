import ShortUniqueId from 'short-unique-id';
import { EntityIdPrefix } from '@shared/common/enum';

const uid = new ShortUniqueId({ length: 16 });

export class EntityIdUtil {
    static generate(prefix: EntityIdPrefix): string {
        return `${prefix}${uid.rnd()}`;
    }
}
