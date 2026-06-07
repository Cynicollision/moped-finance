import ShortUniqueId from 'short-unique-id';

const uid = new ShortUniqueId({ length: 16 });

export class EntityIdUtil {
    static generate<T extends string>(prefix: T): string {
        return `${prefix}${uid.rnd()}`;
    }
}
