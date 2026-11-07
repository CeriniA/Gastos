/**
 * Files that today go over a size or complexity limit of docs/ESTANDARES_CODIGO.md.
 *
 * This list may only get shorter: a file leaves it when it is split and passes, and a new file never
 * enters it. Each file is split when a change of docs/LOGICA_NEGOCIO.md has to touch it anyway.
 * Measured on 2026-11-07 (blank lines and comments do not count).
 */
export const TEMPORARY_EXCEPTIONS = {
  'max-lines': [
    'backend/src/modules/documents/documents.service.ts',
    'backend/src/modules/transactions/transactions.repository.ts',
    'frontend/src/features/documents/ReviewPage.tsx',
    'frontend/src/features/transactions/TransactionFormPage.tsx',
  ],
  'max-lines-per-function': [
    'backend/src/modules/accounts/accounts.service.ts',
    'backend/src/modules/backup/driveBackup.ts',
    'backend/src/modules/card-periods/cardPeriods.service.ts',
    'backend/src/modules/categories/categories.service.ts',
    'backend/src/modules/documents/documents.service.ts',
    'backend/src/modules/installment-plans/installmentPlans.service.ts',
    'backend/src/modules/recurrings/recurrings.service.ts',
    'backend/src/modules/reports/reports.service.ts',
    'backend/src/modules/spreadsheet/spreadsheet.service.ts',
    'backend/src/modules/transactions/transactions.service.ts',
    'backend/src/modules/users/users.service.ts',
    'backend/src/providers/ai/gemini.ts',
    'backend/src/providers/ai/normalize.ts',
    'backend/src/providers/drive/googleDrive.ts',
    'backend/src/scripts/demoReading.ts',
    'backend/src/wiring.ts',
    'frontend/src/features/accounts/AccountsPage.tsx',
    'frontend/src/features/cards/CardsPage.tsx',
    'frontend/src/features/cards/PaymentForm.tsx',
    'frontend/src/features/categories/CategoriesPage.tsx',
    'frontend/src/features/data/DataPage.tsx',
    'frontend/src/features/documents/AddPage.tsx',
    'frontend/src/features/documents/ReviewPage.tsx',
    'frontend/src/features/documents/StatementPage.tsx',
    'frontend/src/features/documents/StatementSection.tsx',
    'frontend/src/features/recurrings/RecurringsPage.tsx',
    'frontend/src/features/remembered/RememberedPage.tsx',
    'frontend/src/features/transactions/ItemsEditor.tsx',
    'frontend/src/features/transactions/TransactionFormPage.tsx',
    'frontend/src/features/transactions/TransactionsPage.tsx',
    'frontend/src/features/users/UsersPage.tsx',
  ],
  'complexity': [
    'backend/src/modules/recurrings/recurrings.service.ts',
    'backend/src/modules/transactions/transactions.service.ts',
    'backend/src/providers/ai/gemini.ts',
    'backend/src/providers/ai/normalize.ts',
    'frontend/src/features/data/DataPage.tsx',
    'frontend/src/features/documents/BalanceCheck.tsx',
    'frontend/src/features/documents/ReviewPage.tsx',
    'frontend/src/features/transactions/TransactionFormPage.tsx',
    'frontend/src/features/transactions/TransactionsPage.tsx',
    'shared/src/importFormat.ts',
    'shared/src/money.ts',
  ],
  'max-depth': [
    'frontend/src/features/documents/ReviewPage.tsx',
  ],
};
