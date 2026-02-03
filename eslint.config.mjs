import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default defineConfig([
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        plugins: {
            '@stylistic': stylistic,
            'unused-imports': unusedImports,
            import: importPlugin,
        },

        languageOptions: {
            globals: {
                ...globals.node,
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
            },
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2018,
                sourceType: 'module',
            },
        },

        rules: {
            curly: 'error',
            'dot-notation': 'error',
            eqeqeq: 'error',
            'no-else-return': 'error',
            'no-empty': 'warn',
            'no-empty-function': 'warn',
            'no-fallthrough': 'warn',
            'no-inner-declarations': 'off',
            'no-unneeded-ternary': 'error',
            'operator-assignment': 'error',
            'prefer-const': 'error',
            'prefer-numeric-literals': 'error',
            'prefer-object-spread': 'error',
            'prefer-rest-params': 'warn',
            yoda: 'error',
            '@stylistic/arrow-spacing': 'error',

            '@stylistic/array-bracket-spacing': ['error', 'always', {
                objectsInArrays: false,
                arraysInArrays: false,
            }],

            '@stylistic/block-spacing': 'error',
            '@stylistic/brace-style': 'error',
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/comma-style': 'error',
            '@stylistic/computed-property-spacing': 'error',
            '@stylistic/dot-location': ['error', 'property'],
            '@stylistic/eol-last': 'error',
            '@stylistic/func-call-spacing': 'error',

            '@stylistic/generator-star-spacing': ['error', {
                before: true,
                after: true,
            }],

            '@stylistic/implicit-arrow-linebreak': 'error',
            '@stylistic/indent': ['error', 4],
            '@stylistic/key-spacing': 'error',
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/linebreak-style': 'error',
            '@stylistic/lines-between-class-members': 'error',
            '@stylistic/multiline-comment-style': 'error',
            '@stylistic/new-parens': 'error',
            '@stylistic/newline-per-chained-call': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-multiple-empty-lines': 'error',
            '@stylistic/no-whitespace-before-property': 'error',

            '@stylistic/object-curly-newline': ['error', {
                consistent: true,
            }],

            '@stylistic/object-curly-spacing': ['error', 'always', {
                objectsInObjects: false,
            }],

            '@stylistic/operator-linebreak': ['error', 'before'],
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/semi-spacing': 'error',
            '@stylistic/semi-style': 'error',
            '@stylistic/space-before-blocks': 'error',

            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always',
            }],

            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/space-infix-ops': 'error',

            '@stylistic/space-unary-ops': ['error', {
                words: true,
                nonwords: false,
            }],

            '@stylistic/spaced-comment': 'error',
            '@stylistic/switch-colon-spacing': 'error',
            '@stylistic/yield-star-spacing': ['error', 'both'],
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/explicit-module-boundary-types': 'warn',
            '@typescript-eslint/no-empty-function': 'warn',

            '@typescript-eslint/no-empty-object-type': ['error', {
                allowObjectTypes: 'always',
            }],

            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-namespace': 'off',

            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],

            'import/first': 'error',
            'import/newline-after-import': 'error',
            'import/no-absolute-path': 'error',
            'import/no-cycle': 'error',
            'import/no-extraneous-dependencies': 'error',
            'import/no-mutable-exports': 'error',
            'import/no-relative-packages': 'error',
            'import/no-unused-modules': 'error',
            'import/no-useless-path-segments': 'error',
            'import/order': 'error',
            'unused-imports/no-unused-imports': 'error',
        },
    },
    {
        files: ['**/spec/*.ts', '**/spec/**/*.ts'],

        rules: {
            'import/no-extraneous-dependencies': ['off'],
            '@typescript-eslint/no-unused-expressions': ['off'],
        },
    },
]);
