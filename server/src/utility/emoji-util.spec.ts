import { EmojiUtil } from './emoji-util';

describe('EmojiUtil', () => {
    it.each([
        ['a plain emoji', '🛒'],
        ['an emoji with a presentation selector', '🍽️'],
        ['an emoji with a skin tone', '👍🏽'],
        ['a zero-width-joiner sequence', '🧑‍🍳'],
        ['a sequence with a skin tone', '🧑🏾‍💻'],
        ['a flag', '🇨🇦'],
        ['a tag sequence flag', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
        ['a keycap', '1️⃣'],
        ['an emoji newer than Unicode 15', '🫩']
    ])('should accept %s', (_, value) => {
        expect(EmojiUtil.isSingleEmoji(value)).toBe(true);
    });

    it.each([
        ['empty text', ''],
        ['a word', 'home'],
        ['a digit', '1'],
        ['two emoji', '🍕🍔'],
        ['an emoji with text', '🛒 food'],
        ['an emoji with a space', ' 🛒'],
        ['a lone skin tone', '🏽'],
        ['a lone regional indicator', '🇨']
    ])('should refuse %s', (_, value) => {
        expect(EmojiUtil.isSingleEmoji(value)).toBe(false);
    });
});
