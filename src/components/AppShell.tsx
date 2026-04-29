import { NavLink, Outlet } from 'react-router-dom'
import './AppShell.css'

interface CurrentUser {
  username: string
  role: string
}

interface AppShellProps {
  currentUser: CurrentUser
  onLogout: () => void
}

const canManage = (role: string) => ['admin', 'gerente'].includes(role)

export default function AppShell({ currentUser, onLogout }: AppShellProps) {
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
          <NavLink to="/mesas">PDV</NavLink>
          <NavLink to="/pendencias">Pagar depois</NavLink>
          {canManage(currentUser.role) && <NavLink to="/produtos">Produtos</NavLink>}
          {canManage(currentUser.role) && <NavLink to="/configuracoes">Usuarios</NavLink>}
          {canManage(currentUser.role) && (
            <NavLink to="/configuracoes-sistema">Configuracoes</NavLink>
          )}
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
