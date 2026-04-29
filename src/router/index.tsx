import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginScreen from '../components/LoginScreen'
import ConfigManager from '../components/ConfigManager'
import CustomerMenu from '../components/CustomerMenu'
import FinanceManager from '../components/FinanceManager'
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

  return (
    <Router>
      <Routes>
        {/* Cardapio publico via QR Code */}
        <Route path="/cardapio" element={<CustomerMenu />} />
        <Route path="/menu" element={<CustomerMenu />} />

        {!currentUser ? (
          <Route
            path="*"
            element={<LoginScreen onLoginSuccess={handleLoginSuccess} />}
          />
        ) : (
          <>
            {/* Redirecionamento para principal */}
            <Route path="/" element={<Navigate to="/mesas" replace />} />

            {/* Rotas principais */}
            <Route
              path="/mesas"
              element={<TableManager currentUser={currentUser} />}
            />
            <Route path="/produtos" element={<ProductManager />} />
            <Route path="/configuracoes" element={<ConfigManager />} />
            <Route path="/painel-quartos" element={<RoomPanel />} />
            <Route path="/financeiro" element={<FinanceManager />} />
            <Route path="/relatorios" element={<ConfigManager />} />
            <Route path="/pendencias" element={<FinanceManager />} />
            <Route
              path="/configuracoes-sistema"
              element={<SettingsManager />}
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/mesas" replace />} />
          </>
        )}
      </Routes>
    </Router>
  )
}
