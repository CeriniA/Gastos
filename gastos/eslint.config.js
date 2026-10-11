import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Besides the usual checks, this file enforces the architecture described in
 * docs/ARQUITECTURA.md: a broken layering rule fails `npm run lint`.
 */

const crossModule = {
  group: ['../*/*.model', '../*/*.repository', '../*/*.service', '../*/*.controller', '../*/*.routes'],
  message:
    "Import another module only through its index.ts, and only what the composition root can't provide.",
};
const noDatabase = {
  group: ['mongoose', './*.model'],
  message: 'Only repositories and models talk to the database.',
};
const noRepository = {
  group: ['./*.repository'],
  message: 'Controllers and routes go through the service.',
};
const noHttp = {
  group: ['express'],
  message: 'Services do not know about HTTP.',
};

const restrict = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dev-dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  { files: ['backend/**/*.ts', '*.js'], languageOptions: { globals: globals.node } },
  { files: ['frontend/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },

  // Backend layers. Later entries replace earlier ones for the files they
  // match, so each lists everything that applies to it.
  restrict(['backend/src/modules/**/*.ts'], [crossModule]),
  restrict(['backend/src/modules/**/*.service.ts'], [crossModule, noDatabase, noHttp]),
  restrict(['backend/src/modules/**/*.controller.ts'], [crossModule, noDatabase, noRepository]),
  restrict(['backend/src/modules/**/*.routes.ts'], [crossModule, noDatabase, noRepository]),

  // The shared package runs in the browser too.
  restrict(
    ['shared/src/**/*.ts'],
    [
      {
        group: ['node:*', 'express', 'mongoose', 'react'],
        message: 'shared must stay free of platform code.',
      },
    ],
  ),
  // Tests may use the Node test runner.
  { files: ['**/*.test.ts'], rules: { 'no-restricted-imports': 'off' } },

  // Frontend: shared building blocks do not depend on features.
  restrict(
    ['frontend/src/shared/**/*.{ts,tsx}'],
    [{ group: ['**/features/**'], message: 'shared/ cannot import from features/.' }],
  ),
);
