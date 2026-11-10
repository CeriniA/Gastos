/** Collection names, defined once so models and reference checks cannot drift. */
export const COLLECTIONS = {
  accounts: 'accounts',
  institutions: 'institutions',
  categories: 'categories',
  tags: 'tags',
  merchants: 'merchants',
  products: 'products',
  transactions: 'transactions',
  documents: 'documents',
  installmentPlans: 'installmentPlans',
  cardPeriods: 'cardPeriods',
  recurrings: 'recurrings',
  categoryRules: 'categoryRules',
  productRules: 'productRules',
  exchangeRates: 'exchangeRates',
  migrations: 'migrations',
  users: 'users',
} as const;
