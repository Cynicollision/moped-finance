// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const stylistic = require('@stylistic/eslint-plugin');

module.exports = defineConfig([
    {
        files: ['**/*.ts'],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.recommended,
            tseslint.configs.stylistic,
            angular.configs.tsRecommended
        ],
        processor: angular.processInlineTemplates,
        plugins: { '@stylistic': stylistic },
        rules: {
            // docs/conventions.md: 4-space indentation, and else/catch on a new line.
            '@stylistic/indent': ['error', 4],
            '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],

            '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
            '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],

            // docs/conventions.md: separate .html and .scss files, OnPush with signals.
            '@angular-eslint/component-max-inline-declarations': ['error', { template: 0, styles: 0, animations: 0 }],
            '@angular-eslint/prefer-on-push-component-change-detection': 'error',
            '@angular-eslint/prefer-signals': 'error',
            '@angular-eslint/prefer-inject': 'error',
            '@angular-eslint/no-output-native': 'error',
            '@typescript-eslint/no-explicit-any': 'error',

            // docs/conventions.md: "today" comes from DateProviderService, and calendar dates are YYYY-MM-DD strings.
            'no-restricted-syntax': ['error', {
                selector: "NewExpression[callee.name='Date'][arguments.length=0]",
                message: 'Get "today" from DateProviderService, not new Date().'
            }, {
                selector: "CallExpression[callee.property.name='toISOString']",
                message: 'toISOString() gives the UTC day, which is the previous day east of UTC. Use CalendarDateUtil.fromDate for a calendar date; timestamps go through JSON as they are.'
            }]
        }
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },
    {
        files: ['**/*.html'],
        extends: [
            angular.configs.templateRecommended,
            angular.configs.templateAccessibility
        ],
        rules: {
            '@angular-eslint/template/prefer-control-flow': 'error',
            '@angular-eslint/template/no-inline-styles': 'error'
        }
    }
]);
