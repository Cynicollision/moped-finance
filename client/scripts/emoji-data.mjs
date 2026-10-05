// Writes the emoji picker's data (public/emoji/data.json) from emoji-picker-element-data, leaving out the Flags group
// (CAT-1.20): Chrome and Edge on Windows have no flag emoji and show each flag as two letters.
// Run `npm run emoji-data` after updating emoji-picker-element-data, and commit the result.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The group numbers are emojibase's, which emoji-picker-element uses for its tabs.
const flagsGroup = 9;

const require = createRequire(import.meta.url);
const source = require.resolve('emoji-picker-element-data/en/emojibase/data.json');
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'emoji', 'data.json');

const emoji = JSON.parse(readFileSync(source, 'utf8'));
const kept = emoji.filter(e => e.group !== flagsGroup);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(kept) + '\n');
console.log(`Wrote ${kept.length} of ${emoji.length} emoji to ${target}`);
