import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useState } from 'react'
import type { ReactElement } from 'react'
import AppShell from '../components/AppShell'
import LoginScreen from '../components/LoginScreen'
import {
  ADMIN_ROLES,
  CASHIER_ROLES,
  DIAGNOSTIC_ROLES,
  MANAGER_ROLES,
  OPERATION_ROLES,
  SUPPORT_ROLES,
  type CurrentUser,
  type PdvRole,
  getHomePath,
  hasRole,
} from '../lib/rolePermissions'

const AppCustomersManager = lazy(() => import('../components/AppCustomersManager'))
const CashClosingManager = lazy(() => import('../components/CashClosingManager'))
const ConfigManager = lazy(() => import('../components/ConfigManager'))
const CustomerApp = lazy(() => import('../components/CustomerApp'))
const CustomerMenu = lazy(() => import('../components/CustomerMenu'))
const DiagnosticsManager = lazy(() => import('../components/DiagnosticsManager'))
const FinanceManager = lazy(() => import('../components/FinanceManager'))
const OrdersManager = lazy(() => import('../components/OrdersManager'))
const PendingPayments = lazy(() => import('../components/PendingPayments'))
const ProductManager = lazy(() => import('../components/ProductManager'))
const RoomPanel = lazy(() => import('../components/RoomPanel'))
const SettingsManager = lazy(() => import('../components/SettingsManager'))
const SupportAiManager = lazy(() => import('../components/SupportAiManager'))
const TableManager = lazy(() => import('../components/TableManager'))

export default function AppRouter() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const handleLoginSuccess = (userData: CurrentUser) => {
    setCurrentUser(userData)
  }

  const handleLogout = () => {
    setCurrentUser(null)
  }

  const requireRole = (element: ReactElement, allowedRoles: PdvRole[]) => {
    if (!currentUser || !hasRole(currentUser, allowedRoles)) {
      return <Navigate to={currentUser ? getHomePath(currentUser) : '/'} replace />
    }

    return element
  }

  return (
    <Router>
      <Suspense fallback={<div role="status" aria-live="polite">Carregando tela...</div>}>
        <Routes>
          {/* Cardapio publico via QR Code */}
          <Route path="/cardapio" element={<CustomerMenu />} />
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/app" element={<CustomerApp />} />

          {!currentUser ? (
            <Route
              path="*"
              element={<LoginScreen onLoginSuccess={handleLoginSuccess} />}
            />
          ) : (
            <Route
              element={
                <AppShell currentUser={currentUser} onLogout={handleLogout} />
              }
            >
            {/* Redirecionamento para principal */}
            <Route path="/" element={<Navigate to={getHomePath(currentUser)} replace />} />

            {/* Rotas principais */}
            <Route
              path="/mesas"
              element={requireRole(
                <TableManager currentUser={currentUser} />,
                OPERATION_ROLES,
              )}
            />
            <Route
              path="/comandas"
              element={requireRole(
                <TableManager currentUser={currentUser} initialViewMode="commands" />,
                OPERATION_ROLES,
              )}
            />
            <Route
              path="/pedidos"
              element={requireRole(<OrdersManager currentUser={currentUser} />, OPERATION_ROLES)}
            />
            <Route
              path="/produtos"
              element={requireRole(<ProductManager />, MANAGER_ROLES)}
            />
            <Route
              path="/clientes-app"
              element={requireRole(
                <AppCustomersManager currentUser={currentUser} />,
                MANAGER_ROLES,
              )}
            />
            <Route
              path="/diagnostico"
              element={requireRole(<DiagnosticsManager />, DIAGNOSTIC_ROLES)}
            />
            <Route
              path="/configuracoes"
              element={requireRole(
                <ConfigManager currentUser={currentUser} />,
                ADMIN_ROLES,
              )}
            />
            <Route
              path="/painel-quartos"
              element={requireRole(<RoomPanel />, OPERATION_ROLES)}
            />
            <Route
              path="/financeiro"
              element={requireRole(<FinanceManager />, CASHIER_ROLES)}
            />
            <Route
              path="/relatorios"
              element={<Navigate to="/configuracoes-sistema" replace />}
            />
            <Route
              path="/pendencias"
              element={requireRole(<PendingPayments currentUser={currentUser} />, CASHIER_ROLES)}
            />
            <Route
              path="/configuracoes-sistema"
              element={requireRole(<SettingsManager />, ADMIN_ROLES)}
            />
            <Route
              path="/fechamento-caixa"
              element={requireRole(
                <CashClosingManager currentUser={currentUser} />,
                CASHIER_ROLES,
              )}
            />
            <Route
              path="/suporte-ia"
              element={requireRole(<SupportAiManager />, SUPPORT_ROLES)}
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/mesas" replace />} />
            </Route>
          )}
        </Routes>
      </Suspense>
    </Router>
  )
}
