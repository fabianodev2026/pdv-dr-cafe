import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ConfigManager.css'

interface User {
  id?: number
  username: string
  password: string
  role: string
}

interface Sale {
  id: number
  created_at: string
  table_number: number
  cashier_name: string
  total_amount: number
}

export default function ConfigManager() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'usuarios'>('usuarios')
  const [users, setUsers] = useState<User[]>([])
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [newUser, setNewUser] = useState<User>({ username: '', password: '', role: 'caixa' })

  const fetchUsers = async () => {
    const { data } = await supabase.from('pdv_users').select('*').order('username')
    if (data) setUsers(data)
  }

  const fetchFinanceData = async () => {
    setIsLoadingSales(true)
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAllSales(data || [])
    } catch (err) {
      console.error('Erro ao buscar financeiro:', (err as Error).message)
    } finally {
      setIsLoadingSales(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchFinanceData()
  }, [])

  const balance = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('pt-BR')
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let totalDay = 0
    let totalMonth = 0
    let totalYear = 0

    allSales.forEach((sale) => {
      const saleDate = new Date(sale.created_at)
      const amount = sale.total_amount

      if (saleDate.toLocaleDateString('pt-BR') === todayStr) {
        totalDay += amount
      }

      if (
        saleDate.getMonth() === currentMonth &&
        saleDate.getFullYear() === currentYear
      ) {
        totalMonth += amount
      }

      if (saleDate.getFullYear() === currentYear) {
        totalYear += amount
      }
    })

    return { totalDay, totalMonth, totalYear }
  }, [allSales])

  const saveUser = async () => {
    if (!newUser.username || !newUser.password) return
    await supabase.from('pdv_users').insert([newUser])
    setNewUser({ username: '', password: '', role: 'caixa' })
    fetchUsers()
  }

  return (
    <div className="config-manager">
      <header className="header">
        <h1 className="title">⚙️ Painel de Controle Dr. Café</h1>
      </header>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'financeiro' ? 'active' : ''}`}
          onClick={() => setActiveTab('financeiro')}
        >
          📊 Balanço Financeiro
        </button>
        <button
          className={`tab-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          👤 Usuários
        </button>
      </div>

      {activeTab === 'financeiro' && (
        <section className="glass-panel">
          <div className="finance-grid">
            <div className="balance-card">
              <span className="card-label">Vendas de Hoje</span>
              <h2 className="card-value">R$ {balance.totalDay.toFixed(2)}</h2>
            </div>
            <div className="balance-card highlighted">
              <span className="card-label">Total do Mês</span>
              <h2 className="card-value">R$ {balance.totalMonth.toFixed(2)}</h2>
            </div>
            <div className="balance-card">
              <span className="card-label">Faturamento Anual</span>
              <h2 className="card-value">R$ {balance.totalYear.toFixed(2)}</h2>
            </div>
          </div>

          <div className="history-section">
            <h3>📜 Últimos Recebimentos</h3>
            {isLoadingSales && <p>Carregando...</p>}
            {allSales.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Mesa</th>
                    <th>Caixa</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {allSales.slice(0, 10).map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.created_at).toLocaleString('pt-BR')}</td>
                      <td>Mesa {sale.table_number}</td>
                      <td>{sale.cashier_name}</td>
                      <td className="price-text">R$ {sale.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Nenhuma venda registrada ainda.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'usuarios' && (
        <section className="glass-panel">
          <h2>Gestão de Equipe</h2>
          <div className="user-form">
            <input
              type="text"
              placeholder="Usuário"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Senha"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="caixa">Caixa</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={saveUser}>Adicionar Usuário</button>
          </div>

          <h3>Usuários Existentes</h3>
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <strong>{user.username}</strong> - {user.role}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
