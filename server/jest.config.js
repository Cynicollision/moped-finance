/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
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
