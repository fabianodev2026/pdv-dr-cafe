import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ConfigManager.css'

type Role = 'admin' | 'gerente' | 'caixa' | 'garcom'

interface CurrentUser {
  username: string
  role: string
}

interface ConfigManagerProps {
  currentUser: CurrentUser
}

interface User {
  username: string
  role: Role
}

interface NewUser {
  username: string
  password: string
  role: Role
}

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  caixa: 'Caixa',
  garcom: 'Garcom',
}

const permissions: Record<Role, string> = {
  admin: 'Acesso total, produtos, usuarios, configuracoes e fechamento.',
  gerente: 'Produtos, usuarios operacionais, configuracoes e fechamento.',
  caixa: 'PDV, comandas, pagamentos e fechamento de vendas.',
  garcom: 'Lancamento de itens em mesas/quartos, sem finalizar pagamento.',
}

export default function ConfigManager({ currentUser }: ConfigManagerProps) {
  const currentRole = currentUser.role as Role
  const [users, setUsers] = useState<User[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [newUser, setNewUser] = useState<NewUser>({
    username: '',
    password: '',
    role: currentRole === 'admin' ? 'gerente' : 'caixa',
  })

  const allowedRoles = useMemo<Role[]>(() => {
    if (currentRole === 'admin') return ['gerente', 'caixa', 'garcom']
    if (currentRole === 'gerente') return ['caixa', 'garcom']
    return []
  }, [currentRole])

  const fetchUsers = async () => {
    setIsLoading(true)
    const { data, error } = await supabase.rpc('list_pdv_users')

    if (error) {
      console.error('Erro ao buscar usuarios:', error)
      setMessage('Execute o SQL atualizado para liberar a listagem de usuarios.')
    } else {
      setUsers((data ?? []) as User[])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const saveUser = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      setMessage('Preencha usuario e senha.')
      return
    }

    if (!allowedRoles.includes(newUser.role)) {
      setMessage('Seu perfil nao pode criar usuarios com esse privilegio.')
      return
    }

    const { error } = await supabase.rpc('create_pdv_user', {
      p_username: newUser.username.trim(),
      p_password: newUser.password,
      p_role: newUser.role,
    })

    if (error) {
      console.error('Erro ao criar usuario:', error)
      setMessage('Nao foi possivel criar o usuario. Execute o SQL atualizado.')
      return
    }

    setMessage('Usuario salvo com sucesso.')
    setNewUser({
      username: '',
      password: '',
      role: currentRole === 'admin' ? 'gerente' : 'caixa',
    })
    fetchUsers()
  }

  return (
    <div className="config-manager">
      <header className="page-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Usuarios</h1>
          <p>Controle quem pode alterar cadastros e operar o PDV.</p>
        </div>
      </header>

      {message && <div className="config-alert">{message}</div>}

      <section className="glass-panel">
        <h2>Criar usuario</h2>
        <div className="user-form">
          <input
            type="text"
            placeholder="Usuario"
            value={newUser.username}
            maxLength={15}
            onChange={(e) =>
              setNewUser({ ...newUser, username: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Senha"
            value={newUser.password}
            maxLength={15}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
          />
          <select
            value={newUser.role}
            onChange={(e) =>
              setNewUser({ ...newUser, role: e.target.value as Role })
            }
          >
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
          <button onClick={saveUser}>Adicionar</button>
        </div>
      </section>

      <section className="glass-panel">
        <h2>Usuarios existentes</h2>
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <div className="user-cards">
            {users.map((user) => (
              <article key={user.username} className="user-card">
                <strong>{user.username}</strong>
                <span>{roleLabels[user.role] ?? user.role}</span>
                <p>{permissions[user.role] ?? 'Permissao personalizada.'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
