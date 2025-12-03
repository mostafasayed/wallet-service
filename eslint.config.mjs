// eslint.config.mjs
import js from '@eslint/js';
import eslintPluginTs from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore build output etc.
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript config for all .ts files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Node + Jest globals available everywhere
      globals: {
        ...globals.node,   // process, console, Buffer, etc.
        ...globals.jest,   // describe, it, expect, jest, beforeEach, etc.
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
    },
    rules: {
      // We let the TS plugin handle unused vars
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // For now, relax this – we can re-enable later if you want
      'no-useless-catch': 'off',
    },
  },

  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
