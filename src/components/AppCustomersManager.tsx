import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './AppCustomersManager.css'

type CustomerStatus = 'pendente' | 'ativo' | 'bloqueado'

interface AppCustomer {
  id: number
  created_at: string
  name: string
  phone: string
  position: string
  email: string
  status: CustomerStatus
  payment_day: number
}

export default function AppCustomersManager() {
  const [customers, setCustomers] = useState<AppCustomer[]>([])
  const [message, setMessage] = useState('')

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Execute o SQL do app para criar app_customers.')
      return
    }

    setMessage('')
    setCustomers(data ?? [])
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const updateStatus = async (customer: AppCustomer, status: CustomerStatus) => {
    const { error } = await supabase
      .from('app_customers')
      .update({ status })
      .eq('id', customer.id)

    if (error) {
      setMessage(`Erro ao atualizar cliente: ${error.message}`)
      return
    }

    fetchCustomers()
  }

  return (
    <div className="app-customers-manager">
      <header className="app-customers-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Clientes do app</h1>
          <p>Controle quem pode usar pagar depois pelo aplicativo.</p>
        </div>
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
              <span>{customer.phone}</span>
              <span>{customer.email}</span>
            </div>
            <strong>{customer.status}</strong>
            <small>
              Pagamento: todo dia {customer.payment_day} util
            </small>
            <div className="app-customer-actions">
              <button onClick={() => updateStatus(customer, 'ativo')}>Liberar</button>
              <button onClick={() => updateStatus(customer, 'bloqueado')}>Bloquear</button>
              <button onClick={() => updateStatus(customer, 'pendente')}>Pendente</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
