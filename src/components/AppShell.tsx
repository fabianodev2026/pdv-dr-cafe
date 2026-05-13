import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import {
  ADMIN_ROLES,
  CASHIER_ROLES,
  MANAGER_ROLES,
  OPERATION_ROLES,
  hasRole,
} from '../lib/rolePermissions'
import { startBackupScheduler } from '../lib/backupService'
import './AppShell.css'

interface CurrentUser {
  username: string
  role: string
}

interface AppShellProps {
  currentUser: CurrentUser
  onLogout: () => void
}

export default function AppShell({ currentUser, onLogout }: AppShellProps) {
  const canOperate = hasRole(currentUser, OPERATION_ROLES)
  const canUseCashier = hasRole(currentUser, CASHIER_ROLES)
  const canManage = hasRole(currentUser, MANAGER_ROLES)
  const canAdmin = hasRole(currentUser, ADMIN_ROLES)

  useEffect(() => {
    const intervalId = startBackupScheduler()
    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <img src="/logo.jpeg" alt="Dr. Cafe" className="brand-logo" />
          <div>
            <strong>Dr. Cafe</strong>
            <span>Cuidando de voce</span>
          </div>
        </div>

        <nav className="app-tabs" aria-label="Abas do PDV">
          {canOperate && <NavLink to="/mesas">PDV</NavLink>}
          {canOperate && <NavLink to="/pedidos">Ultimos pedidos feitos</NavLink>}
          {canUseCashier && <NavLink to="/pendencias">Pagar depois</NavLink>}
          {canManage && <NavLink to="/almoco-do-dia">Almoco do dia</NavLink>}
          {canManage && <NavLink to="/clientes-app">Clientes app</NavLink>}
          {canManage && <NavLink to="/produtos">Produtos</NavLink>}
          {canAdmin && <NavLink to="/configuracoes">Usuarios</NavLink>}
          {canAdmin && (
            <NavLink to="/configuracoes-sistema">Configuracoes</NavLink>
          )}
          {canUseCashier && <NavLink to="/fechamento-caixa">Fechamento</NavLink>}
        </nav>

        <div className="user-badge">
          <span>{currentUser.username}</span>
          <strong>{currentUser.role}</strong>
          <button onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <section className="app-content">
        <Outlet />
      </section>
    </div>
  )
}
