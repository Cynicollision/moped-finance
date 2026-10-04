// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
    { ignores: ['dist/', 'public/', 'test_data/'] },
    {
        files: ['**/*.ts'],
        extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            // A leading underscore marks a parameter that's part of a signature but unused (a stub's arguments).
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],

            // docs/conventions.md: IDs come from EntityId, "now" from DateTimeUtil, and routes read requests
            // only through execute's schemas.
            'no-restricted-imports': [
                'error',
                {
                    paths: [{ name: 'short-unique-id', message: 'Generate IDs with EntityId (@server/data).' }]
                }
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
                    message: 'Get "now" from DateTimeUtil (@server/utility), not new Date().'
                },
                {
                    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
                    message: 'Get "now" from DateTimeUtil (@server/utility), not Date.now().'
                },
                {
                    selector: "MemberExpression[object.name='req'][property.name=/^(body|query|params)$/]",
                    message: "Read requests through handler.execute's schemas and use the parsed values it passes."
                }
            ]
        }
    },
    {
        files: ['**/entity-id.ts'],
        rules: { 'no-restricted-imports': 'off' }
    },
    {
        files: ['**/date-time-util.ts'],
        rules: { 'no-restricted-syntax': 'off' }
    },
    {
        files: ['**/*.spec.ts', '**/utility/testing/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-restricted-syntax': 'off'
        }
    }
]);
