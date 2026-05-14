import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './AppCustomersManager.css'

type CustomerStatus = 'pendente' | 'ativo' | 'bloqueado'

interface AppCustomer {
  id: number
  created_at: string
  name: string
  login?: string
  phone: string
  position: string
  email: string
  status: CustomerStatus
  payment_day: number
  credit_limit: number
}

interface CurrentUser {
  username: string
  role: string
}

interface AppCustomersManagerProps {
  currentUser: CurrentUser
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const statusMessages: Record<CustomerStatus, string> = {
  ativo: 'Cliente ativo',
  bloqueado: 'Cliente bloqueado',
  pendente: 'Cliente pendente',
}

const sortAppCustomers = (customers: AppCustomer[]) =>
  [...customers].sort((first, second) => {
    if (first.status === 'pendente' && second.status !== 'pendente') return -1
    if (first.status !== 'pendente' && second.status === 'pendente') return 1

    if (first.status === 'pendente' && second.status === 'pendente') {
      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
    }

    return first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' })
  })

export default function AppCustomersManager({ currentUser }: AppCustomersManagerProps) {
  const [customers, setCustomers] = useState<AppCustomer[]>([])
  const [creditInputs, setCreditInputs] = useState<Record<number, string>>({})
  const [message, setMessage] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isAdmin = currentUser.role === 'admin'

  const fetchCustomers = async (showSuccessMessage = false) => {
    setIsRefreshing(true)
    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setMessage('Execute o SQL do app para criar app_customers.')
      setIsRefreshing(false)
      return
    }

    setMessage(showSuccessMessage ? 'Clientes do app atualizados.' : '')
    const nextCustomers = sortAppCustomers(data ?? [])
    setCustomers(nextCustomers)
    setCreditInputs(
      Object.fromEntries(
        nextCustomers.map((customer) => [customer.id, String(Number(customer.credit_limit || 0))]),
      ),
    )
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const updateStatus = async (customer: AppCustomer, status: CustomerStatus) => {
    const { error } = await supabase.from('app_customers').update({ status }).eq('id', customer.id)

    if (error) {
      setMessage(`Erro ao atualizar cliente: ${error.message}`)
      return
    }

    await fetchCustomers()
    window.alert(`${statusMessages[status]}: ${customer.name}.`)
  }

  const updateCreditLimit = async (customer: AppCustomer) => {
    if (!isAdmin) {
      setMessage('Somente administrador geral pode alterar limite.')
      return
    }

    const value = creditInputs[customer.id] ?? String(Number(customer.credit_limit || 0))
    const creditLimit = Number(value.replace(',', '.') || 0)
    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      setMessage('Informe um saldo valido.')
      return
    }

    const adminPassword = window.prompt('Confirme sua senha de administrador.')
    if (!adminPassword) return

    const { error } = await supabase.rpc('admin_update_app_customer_credit_limit', {
      p_admin_username: currentUser.username,
      p_admin_password: adminPassword,
      p_customer_id: customer.id,
      p_credit_limit: creditLimit,
    })

    if (error) {
      setMessage(`Erro ao salvar saldo: ${error.message}`)
      return
    }

    await fetchCustomers()
    setMessage('Saldo adicionado com sucesso.')
  }

  const deleteCustomer = async (customer: AppCustomer) => {
    if (!isAdmin) {
      setMessage('Somente administrador geral pode excluir conta do app.')
      return
    }

    const confirmed = window.confirm(
      `Excluir a conta do app de ${customer.name}? Esta acao nao remove historico financeiro.`,
    )
    if (!confirmed) return

    const adminPassword = window.prompt('Confirme sua senha de administrador.')
    if (!adminPassword) return

    const { error } = await supabase.rpc('admin_delete_app_customer', {
      p_admin_username: currentUser.username,
      p_admin_password: adminPassword,
      p_customer_id: customer.id,
    })

    if (error) {
      setMessage(`Erro ao excluir cliente: ${error.message}`)
      return
    }

    await fetchCustomers()
    setMessage(`Conta do app de ${customer.name} excluida.`)
  }

  const resetCustomerPassword = async (customer: AppCustomer) => {
    if (!isAdmin) {
      setMessage('Somente administrador geral pode resetar senha.')
      return
    }

    const temporaryPassword = window.prompt(
      `Digite a senha provisoria para ${customer.name}. Depois o cliente troca no app.`,
    )
    if (!temporaryPassword) return

    if (temporaryPassword.trim().length > 20) {
      setMessage('Senha provisoria deve ter ate 20 caracteres.')
      return
    }

    const adminPassword = window.prompt('Confirme sua senha de administrador.')
    if (!adminPassword) return

    const { error } = await supabase.rpc('admin_reset_app_customer_password', {
      p_admin_username: currentUser.username,
      p_admin_password: adminPassword,
      p_customer_id: customer.id,
      p_new_password: temporaryPassword.trim(),
    })

    if (error) {
      setMessage(`Erro ao resetar senha: ${error.message}`)
      return
    }

    setMessage(
      `Senha de ${customer.name} resetada. Informe a senha provisoria para o cliente trocar no app.`,
    )
  }

  return (
    <div className="app-customers-manager">
      <header className="app-customers-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Clientes do app</h1>
          <p>Controle quem pode usar pagar depois pelo aplicativo.</p>
          {!isAdmin && (
            <p className="app-customers-note">
              Limite e exclusao ficam disponiveis somente para administrador geral.
            </p>
          )}
        </div>
        <button
          type="button"
          className="app-customers-refresh"
          onClick={() => fetchCustomers(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      {message && <div className="app-customers-alert">{message}</div>}

      <section className="app-customers-grid">
        {customers.length === 0 && (
          <p className="app-customers-empty">Nenhum cadastro recebido ainda.</p>
        )}

        {customers.map((customer) => (
          <article key={customer.id} className={`app-customer-card ${customer.status}`}>
            <div>
              <h2>{customer.name}</h2>
              <p>{customer.position || 'Cargo nao informado'}</p>
              {customer.login && <span>Login: {customer.login}</span>}
              <span>{customer.phone}</span>
              <span>{customer.email}</span>
            </div>
            <strong>{customer.status}</strong>
            <small>Pagamento: todo dia {customer.payment_day} util</small>
            <small>Limite: {currencyFormatter.format(Number(customer.credit_limit || 0))}</small>
            <div className="app-customer-actions">
              <button onClick={() => updateStatus(customer, 'ativo')}>Liberar</button>
              <button onClick={() => updateStatus(customer, 'bloqueado')}>Bloquear</button>
              <button onClick={() => updateStatus(customer, 'pendente')}>Pendente</button>
            </div>
            {isAdmin && (
              <div className="app-customer-admin-actions">
                <label>
                  Saldo disponivel
                  <div className="app-customer-money-field">
                    <span>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={creditInputs[customer.id] ?? String(Number(customer.credit_limit || 0))}
                      onChange={(event) =>
                        setCreditInputs((current) => ({
                          ...current,
                          [customer.id]: event.target.value.replace(/[^\d.,]/g, ''),
                        }))
                      }
                    />
                  </div>
                </label>
                <button
                  type="button"
                  className="app-customer-save-balance"
                  onClick={() => updateCreditLimit(customer)}
                >
                  Salvar saldo
                </button>
                <button type="button" onClick={() => resetCustomerPassword(customer)}>
                  Resetar senha
                </button>
                <button onClick={() => deleteCustomer(customer)}>Excluir conta</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
