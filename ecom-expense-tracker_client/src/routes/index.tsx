import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequireGuest } from './guards'

// Lazy pages
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AddExpensePage } from '@/features/expenses/AddExpensePage'
import { ExpenseListPage } from '@/features/expenses/ExpenseListPage'
import { ExpenseDetailPage } from '@/features/expenses/ExpenseDetailPage'
import { EditExpensePage } from '@/features/expenses/EditExpensePage'
import { PettyCashPage } from '@/features/petty-cash/PettyCashPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  // Guest only routes
  {
    element: <RequireGuest />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },

  // Authenticated employee routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/expenses',
            element: <ExpenseListPage />,
          },
          {
            path: '/expenses/new',
            element: <AddExpensePage />,
          },
          {
            path: '/expenses/:id',
            element: <ExpenseDetailPage />,
          },
          {
            path: '/expenses/:id/edit',
            element: <EditExpensePage />,
          },
          {
            path: '/petty-cash',
            element: <PettyCashPage />,
          },
          {
            path: '/reports',
            element: <ReportsPage />,
          },
          {
            path: '/settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },

  // 404 Catch-all
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

