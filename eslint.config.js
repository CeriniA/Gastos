import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { TEMPORARY_EXCEPTIONS } from './lint-exceptions.js';

/**
 * Besides the usual checks, this file enforces the architecture described in
 * docs/ARQUITECTURA.md: a broken layering rule fails `npm run lint`.
 */

const crossModule = {
  // Anything that starts with a letter after "../" is a sibling module ("../../core/..." is not).
  group: ['../[a-z]*'],
  message:
    'A module does not import another one. What it needs from it, wiring.ts gives it as a function.',
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

/** What AGENTS.md asks of every frontend file, checked instead of trusted. */
const FRONTEND_SYNTAX = [
  {
    selector: 'JSXText[value=/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/]',
    message: 'User-facing text goes in frontend/src/shared/i18n/es.ts.',
  },
  {
    selector:
      'JSXAttribute[name.name=/^(aria-label|placeholder|title|alt)$/] > Literal[value=/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/]',
    message: 'User-facing text goes in frontend/src/shared/i18n/es.ts.',
  },
  {
    selector: "Literal[value='es-AR']",
    message: 'Use APP_LOCALE from @gastos/shared.',
  },
  {
    selector: "Literal[value='ARS']",
    message: 'Use DEFAULT_CURRENCY from @gastos/shared.',
  },
];

/** A screen that saves something reports its errors through useAction(), not through its own try/catch. */
const noOwnTryCatch = {
  selector: 'TryStatement',
  message:
    'Use useAction() (frontend/src/shared/ui/useAction.ts) to run a change and show its error. If this is not a saving action, say why with an eslint-disable comment.',
};

/** The limits of docs/ESTANDARES_CODIGO.md. Files that do not meet them yet are listed in lint-exceptions.js. */
const SIZE_RULES = {
  'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ['error', 15],
  'max-params': ['error', 4],
  'max-depth': ['error', 4],
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
  { files: ['backend/**/*.ts', '*.js', 'scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
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

  // Frontend: what AGENTS.md asks, checked instead of trusted. Texts live in es.ts;
  // the locale and the default currency come from shared/src/constants.ts.
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    ignores: ['frontend/src/shared/i18n/**'],
    rules: {
      'no-restricted-syntax': ['error', ...FRONTEND_SYNTAX],
    },
  },

  // Frontend: shared building blocks do not depend on features.
  restrict(
    ['frontend/src/shared/**/*.{ts,tsx}'],
    [{ group: ['**/features/**'], message: 'shared/ cannot import from features/.' }],
  ),
  // Screens: the same selectors, plus no try/catch of their own.
  {
    files: ['frontend/src/features/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...FRONTEND_SYNTAX, noOwnTryCatch] },
  },

  // Size and complexity of the code that runs in the app (tests, the in-memory backend and Spanish texts are not measured).
  {
    files: ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'shared/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'backend/src/testing/**', 'frontend/src/shared/i18n/**'],
    rules: SIZE_RULES,
  },
  // The files that do not meet a limit yet (this list only gets shorter).
  ...Object.entries(TEMPORARY_EXCEPTIONS).map(([rule, files]) => ({ files, rules: { [rule]: 'off' } })),
);
