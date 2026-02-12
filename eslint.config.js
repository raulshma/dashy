//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: ['.output/**', 'dist/**', 'node_modules/**'],
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
