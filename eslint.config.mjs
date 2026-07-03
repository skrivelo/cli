import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  Blob: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly'
}

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: nodeGlobals
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      // TypeScript resolves globals/types itself; core no-undef mis-flags
      // type-only globals like `NodeJS` and `RequestInit`.
      'no-undef': 'off'
    }
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/']
  }
]
