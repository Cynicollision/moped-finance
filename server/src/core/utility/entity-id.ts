import ShortUniqueId from 'short-unique-id';

export enum CoreEntityIdPrefix {
    User = '01',
    Log = '02',
}

export class EntityIdUtil {
    private static uid = new ShortUniqueId({ length: 16 });

    public static generate(prefix?: string): string {
        return prefix ? `${prefix}${this.uid.rnd()}` : this.uid.rnd();
    }
}
