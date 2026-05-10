import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import type { ReactElement } from 'react'
import AppShell from '../components/AppShell'
import AppCustomersManager from '../components/AppCustomersManager'
import LoginScreen from '../components/LoginScreen'
import ConfigManager from '../components/ConfigManager'
import CustomerApp from '../components/CustomerApp'
import CustomerMenu from '../components/CustomerMenu'
import DailyLunchManager from '../components/DailyLunchManager'
import DiagnosticsManager from '../components/DiagnosticsManager'
import FinanceManager from '../components/FinanceManager'
import OrdersManager from '../components/OrdersManager'
import PendingPayments from '../components/PendingPayments'
import ProductManager from '../components/ProductManager'
import RoomPanel from '../components/RoomPanel'
import SettingsManager from '../components/SettingsManager'
import SupportAiManager from '../components/SupportAiManager'
import TableManager from '../components/TableManager'
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
              element={requireRole(<OrdersManager />, OPERATION_ROLES)}
            />
            <Route
              path="/produtos"
              element={requireRole(<ProductManager />, MANAGER_ROLES)}
            />
            <Route
              path="/almoco-do-dia"
              element={requireRole(<DailyLunchManager />, MANAGER_ROLES)}
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
              element={requireRole(<PendingPayments />, CASHIER_ROLES)}
            />
            <Route
              path="/configuracoes-sistema"
              element={requireRole(<SettingsManager />, ADMIN_ROLES)}
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
    </Router>
  )
}
