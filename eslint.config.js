const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/htmlcov/**',
      '**/*.min.js',
      '**/.history/**',
      '**/venv/**',
      '**/.venv/**',
      '**/python/**',
      '**/.pytest_cache/**',
      '**/__pycache__/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.benchmarks/**',
    ],
  },
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        // Electron globals
        electronAPI: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
      'no-throw-literal': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prettier/prettier': 'warn',
    },
  },
];
