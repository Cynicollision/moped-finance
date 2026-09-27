// Tests run west of UTC, where "today" and calendar dates differ from UTC's in the evening, so code that converts a
// calendar date through UTC fails here as well as for users (APP-5.6). Workers inherit it; Jest's per-file sandbox
// copies process.env, so a test can't change the zone itself.
process.env.TZ = 'America/New_York';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // shared/ has no test runner of its own; its specs run with the server's.
    roots: ['<rootDir>', '<rootDir>/../shared'],
    moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/../shared/$1',
        '^@server/(.*)$': '<rootDir>/src/$1',
    },
    testMatch: ['**/*.spec.ts'],
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
};
