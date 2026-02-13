//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.output/**',
      'dist/**',
      'node_modules/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
  {
    rules: {
      // ─── Import ordering ─────────────────────────
      'sort-imports': [
        'warn',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          allowSeparatedGroups: true,
        },
      ],

      // ─── Code quality ────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',

      // ─── TypeScript rules ────────────────────────
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    // Relax rules for config/script files
    files: ['*.config.*', 'scripts/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
]
