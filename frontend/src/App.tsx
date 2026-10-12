import { Navigate, Route, Routes } from 'react-router-dom';
import { AccountsPage } from './features/accounts/AccountsPage';
import { useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { DataPage } from './features/data/DataPage';
import { AddPage } from './features/documents/AddPage';
import { PendingPage } from './features/documents/PendingPage';
import { ReviewPage } from './features/documents/ReviewPage';
import { HomePage } from './features/home/HomePage';
import { MorePage } from './features/more/MorePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { TagsPage } from './features/tags/TagsPage';
import { TransactionFormPage } from './features/transactions/TransactionFormPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { TrashPage } from './features/transactions/TrashPage';
import { AppShell } from './shared/layout/AppShell';

/** Route paths are in Spanish because the user sees them in the address bar. */
export function App() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="agregar" element={<AddPage />} />
        <Route path="pendientes" element={<PendingPage />} />
        <Route path="pendientes/:id" element={<ReviewPage />} />
        <Route path="movimientos" element={<TransactionsPage />} />
        <Route path="movimientos/nuevo" element={<TransactionFormPage key="new" />} />
        <Route path="movimientos/:id" element={<TransactionFormPage key="edit" />} />
        <Route path="informes" element={<ReportsPage />} />
        <Route path="mas" element={<MorePage />} />
        <Route path="mas/cuentas" element={<AccountsPage />} />
        <Route path="mas/categorias" element={<CategoriesPage />} />
        <Route path="mas/etiquetas" element={<TagsPage />} />
        <Route path="mas/papelera" element={<TrashPage />} />
        <Route path="mas/datos" element={<DataPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
