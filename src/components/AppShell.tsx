import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ADMIN_ROLES,
  CASHIER_ROLES,
  MANAGER_ROLES,
  OPERATION_ROLES,
  hasRole,
} from '../lib/rolePermissions'
import { startBackupScheduler } from '../lib/backupService'
import { startOfflineAutoSync } from '../lib/offlineSyncService'
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
  const [connectionNotice, setConnectionNotice] = useState(() => ({
    status: navigator.onLine ? 'online' : 'offline',
    visible: !navigator.onLine,
  }))

  useEffect(() => {
    const intervalId = startBackupScheduler()
    const stopOfflineAutoSync = startOfflineAutoSync()
    return () => {
      window.clearInterval(intervalId)
      stopOfflineAutoSync()
    }
  }, [])

  useEffect(() => {
    const showOnline = () => {
      setConnectionNotice({ status: 'online', visible: true })
    }
    const showOffline = () => {
      setConnectionNotice({ status: 'offline', visible: true })
    }

    window.addEventListener('online', showOnline)
    window.addEventListener('offline', showOffline)

    return () => {
      window.removeEventListener('online', showOnline)
      window.removeEventListener('offline', showOffline)
    }
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
      {connectionNotice.visible && (
        <div
          className={`connection-notice ${connectionNotice.status}`}
          role="status"
          aria-live="polite"
        >
          <span>
            {connectionNotice.status === 'online'
              ? 'Operando online'
              : 'Operando offline'}
          </span>
          <button
            type="button"
            aria-label="Fechar aviso de conexao"
            onClick={() =>
              setConnectionNotice((current) => ({ ...current, visible: false }))
            }
          >
            x
          </button>
        </div>
      )}
    </div>
  )
}
