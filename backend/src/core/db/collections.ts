/** Collection names, defined once so models and reference checks cannot drift. */
export const COLLECTIONS = {
  accounts: 'accounts',
  categories: 'categories',
  tags: 'tags',
  transactions: 'transactions',
  documents: 'documents',
  installmentPlans: 'installmentPlans',
  cardPeriods: 'cardPeriods',
  recurrings: 'recurrings',
  categoryRules: 'categoryRules',
  exchangeRates: 'exchangeRates',
  migrations: 'migrations',
  authState: 'authState',
} as const;
