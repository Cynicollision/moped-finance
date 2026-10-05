// One emoji: a pictograph with an optional presentation selector or skin tone, joined to more by zero-width
// joiners (🧑‍🍳), with optional tags (the England flag). Or a flag (two regional indicators), or a keycap (1️⃣).
// Extended_Pictographic covers code points set aside for future emoji, so emoji newer than Node's Unicode tables pass.
const pictograph = String.raw`\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?`;
const singleEmoji = new RegExp(
    String.raw`^(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|${pictograph}(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:‍${pictograph})*)$`,
    'u'
);

export class EmojiUtil {
    /** Whether `value` is exactly one emoji, as an emoji picker produces: no text, and not two emoji side by side. */
    public static isSingleEmoji(value: string): boolean {
        return singleEmoji.test(value);
    }
}
