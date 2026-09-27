import { defineConfig } from 'vitest/config';

// Tests run west of UTC, where a calendar date parsed as UTC (new Date('2026-05-01')) lands on the previous day, so
// that mistake fails here as well as for users. Lint bans toISOString(), the matching mistake east of UTC. Set here,
// before Vitest starts its workers, so every test file runs in it.
process.env.TZ = 'America/New_York';

export default defineConfig({});
