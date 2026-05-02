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

interface CurrentUser {
  id?: number
  username: string
  role: string
}

const MANAGER_ROLES = ['admin', 'gerente']
const SUPPORT_ROLES = ['suporte_tecnico']

function hasRole(currentUser: CurrentUser, allowedRoles: string[]) {
  return allowedRoles.includes(currentUser.role)
}

export default function AppRouter() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const handleLoginSuccess = (userData: CurrentUser) => {
    setCurrentUser(userData)
  }

  const handleLogout = () => {
    setCurrentUser(null)
  }

  const requireRole = (element: ReactElement, allowedRoles: string[]) => {
    if (!currentUser || !hasRole(currentUser, allowedRoles)) {
      return <Navigate to="/mesas" replace />
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
            <Route path="/" element={<Navigate to="/mesas" replace />} />

            {/* Rotas principais */}
            <Route
              path="/mesas"
              element={<TableManager currentUser={currentUser} />}
            />
            <Route path="/pedidos" element={<OrdersManager />} />
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
              element={requireRole(<AppCustomersManager />, MANAGER_ROLES)}
            />
            <Route
              path="/diagnostico"
              element={requireRole(<DiagnosticsManager />, MANAGER_ROLES)}
            />
            <Route
              path="/configuracoes"
              element={requireRole(
                <ConfigManager currentUser={currentUser} />,
                MANAGER_ROLES,
              )}
            />
            <Route path="/painel-quartos" element={<RoomPanel />} />
            <Route
              path="/financeiro"
              element={requireRole(<FinanceManager />, MANAGER_ROLES)}
            />
            <Route
              path="/relatorios"
              element={<Navigate to="/configuracoes-sistema" replace />}
            />
            <Route path="/pendencias" element={<PendingPayments />} />
            <Route
              path="/configuracoes-sistema"
              element={requireRole(<SettingsManager />, MANAGER_ROLES)}
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
