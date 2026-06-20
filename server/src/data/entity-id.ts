import ShortUniqueId from 'short-unique-id';

export class EntityId {
    private static uid = new ShortUniqueId({ length: 16 });

    public static generate(prefix?: string): string {
        return prefix ? `${prefix}${this.uid.rnd()}` : this.uid.rnd();
    }
}
