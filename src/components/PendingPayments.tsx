import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './PendingPayments.css'

interface PendingPayment {
  id: number
  customer_name: string
  phone: string
  position: string
  description: string
  items_detail: string
  total_amount: number
  purchase_date: string
  due_date: string
  status: string
}

interface NewPending {
  customer_name: string
  phone: string
  position: string
  description: string
  items_detail: string
  total_amount: string
  purchase_date: string
  due_date: string
}

const initialPending: NewPending = {
  customer_name: '',
  phone: '',
  position: '',
  description: '',
  items_detail: '',
  total_amount: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  due_date: '',
}

export default function PendingPayments() {
  const [pendingList, setPendingList] = useState<PendingPayment[]>([])
  const [newPending, setNewPending] = useState<NewPending>(initialPending)
  const [message, setMessage] = useState('')

  const totalPending = useMemo(
    () =>
      pendingList
        .filter((payment) => payment.status === 'pendente')
        .reduce((sum, payment) => sum + Number(payment.total_amount), 0),
    [pendingList],
  )

  const fetchPending = async () => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select('*')
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar pendencias:', error)
      setMessage('Execute o SQL atualizado para criar pending_payments.')
    } else {
      setPendingList(data ?? [])
    }
  }

  useEffect(() => {
    fetchPending()
  }, [])

  const handleAddPending = async () => {
    if (!newPending.customer_name.trim() || !newPending.phone.trim() || !newPending.due_date) {
      setMessage('Informe nome, telefone e data de pagamento.')
      return
    }

    const { error } = await supabase.from('pending_payments').insert([
      {
        ...newPending,
        total_amount: Number(newPending.total_amount || 0),
        status: 'pendente',
      },
    ])

    if (error) {
      console.error('Erro ao registrar pendencia:', error)
      setMessage('Nao foi possivel registrar a pendencia.')
      return
    }

    setMessage('Pendencia registrada. Pagamento somente por Pix ou dinheiro.')
    setNewPending(initialPending)
    fetchPending()
  }

  const markAsPaid = async (id: number) => {
    const { error } = await supabase
      .from('pending_payments')
      .update({ status: 'pago' })
      .eq('id', id)

    if (!error) fetchPending()
  }

  return (
    <div className="pending-payments">
      <header className="pending-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Pagar depois</h1>
          <p>Pagamento somente por Pix ou dinheiro.</p>
        </div>
      </header>

      {message && <div className="payment-note">{message}</div>}

      <section className="add-form">
        <h2>Nova pendencia</h2>
        <div className="form-grid">
          <label>
            Nome
            <input
              value={newPending.customer_name}
              onChange={(e) =>
                setNewPending({ ...newPending, customer_name: e.target.value })
              }
              placeholder="Nome do cliente"
            />
          </label>
          <label>
            Telefone
            <input
              value={newPending.phone}
              onChange={(e) =>
                setNewPending({ ...newPending, phone: e.target.value })
              }
              placeholder="Telefone"
            />
          </label>
          <label>
            Cargo
            <input
              value={newPending.position}
              onChange={(e) =>
                setNewPending({ ...newPending, position: e.target.value })
              }
              placeholder="Cargo que ocupa"
            />
          </label>
          <label>
            Data de pagamento
            <input
              type="date"
              value={newPending.due_date}
              onChange={(e) =>
                setNewPending({ ...newPending, due_date: e.target.value })
              }
            />
          </label>
          <label className="wide">
            Itens consumidos
            <input
              value={newPending.items_detail}
              onChange={(e) =>
                setNewPending({ ...newPending, items_detail: e.target.value })
              }
              placeholder="Ex: 1 Cafe expresso, 2 Paes de queijo"
            />
          </label>
          <label className="wide">
            Observacao
            <input
              value={newPending.description}
              onChange={(e) =>
                setNewPending({ ...newPending, description: e.target.value })
              }
              placeholder="Observacao"
            />
          </label>
          <label>
            Valor
            <input
              type="number"
              step="0.01"
              value={newPending.total_amount}
              onChange={(e) =>
                setNewPending({ ...newPending, total_amount: e.target.value })
              }
              placeholder="0,00"
            />
          </label>
        </div>
        <button onClick={handleAddPending} className="btn-primary">
          Registrar pendencia
        </button>
      </section>

      <section className="list-section">
        <h2>Contas pendentes - R$ {totalPending.toFixed(2)}</h2>
        <div className="pending-grid">
          {pendingList.map((pending) => (
            <article key={pending.id} className={`pending-card ${pending.status}`}>
              <div className="card-header">
                <h3>{pending.customer_name}</h3>
                <span>{pending.status}</span>
              </div>
              <p><strong>Telefone:</strong> {pending.phone}</p>
              <p><strong>Cargo:</strong> {pending.position || '-'}</p>
              <p><strong>Consumiu:</strong> {pending.items_detail || '-'}</p>
              <p><strong>Observacao:</strong> {pending.description || '-'}</p>
              <p><strong>Valor:</strong> R$ {Number(pending.total_amount).toFixed(2)}</p>
              <p><strong>Pagamento:</strong> {pending.due_date}</p>
              <p className="payment-only">Somente Pix ou dinheiro</p>
              {pending.status === 'pendente' && (
                <button onClick={() => markAsPaid(pending.id)}>Marcar como pago</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
