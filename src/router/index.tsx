import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import AppShell from '../components/AppShell'
import AppCustomersManager from '../components/AppCustomersManager'
import LoginScreen from '../components/LoginScreen'
import ConfigManager from '../components/ConfigManager'
import CustomerApp from '../components/CustomerApp'
import CustomerMenu from '../components/CustomerMenu'
import DailyLunchManager from '../components/DailyLunchManager'
import FinanceManager from '../components/FinanceManager'
import OrdersManager from '../components/OrdersManager'
import PendingPayments from '../components/PendingPayments'
import ProductManager from '../components/ProductManager'
import RoomPanel from '../components/RoomPanel'
import SettingsManager from '../components/SettingsManager'
import TableManager from '../components/TableManager'

interface CurrentUser {
  id?: number
  username: string
  role: string
}

export default function AppRouter() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const handleLoginSuccess = (userData: CurrentUser) => {
    setCurrentUser(userData)
  }

  const handleLogout = () => {
    setCurrentUser(null)
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
            <Route path="/produtos" element={<ProductManager />} />
            <Route path="/almoco-do-dia" element={<DailyLunchManager />} />
            <Route path="/clientes-app" element={<AppCustomersManager />} />
            <Route
              path="/configuracoes"
              element={<ConfigManager currentUser={currentUser} />}
            />
            <Route path="/painel-quartos" element={<RoomPanel />} />
            <Route path="/financeiro" element={<FinanceManager />} />
            <Route
              path="/relatorios"
              element={<Navigate to="/configuracoes-sistema" replace />}
            />
            <Route path="/pendencias" element={<PendingPayments />} />
            <Route
              path="/configuracoes-sistema"
              element={<SettingsManager />}
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/mesas" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  )
}
