import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './OrdersManager.css'

type OrderStatus = 'novo' | 'recebido' | 'preparo' | 'pronto'

interface RoomOrderItem {
  name: string
  quantity: number
  unit_price: number
}

interface RoomOrder {
  id: number
  created_at: string
  room_number: number
  patient_name: string
  phone: string
  items: RoomOrderItem[]
  total_amount: number
  status: OrderStatus
  customer_message?: string | null
}

const statusMessages: Record<OrderStatus, string> = {
  novo: 'Pedido enviado para o PDV.',
  recebido: 'Seu pedido foi recebido.',
  preparo: 'Seu pedido esta em preparo.',
  pronto: 'Seu pedido esta pronto para entrega.',
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<RoomOrder[]>([])
  const [message, setMessage] = useState('')

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status !== 'pronto').length,
    [orders],
  )

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('room_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar pedidos:', error)
      setMessage('Execute o SQL atualizado para criar room_orders.')
      return
    }

    setOrders((data ?? []) as RoomOrder[])
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const updateStatus = async (order: RoomOrder, status: OrderStatus) => {
    const { error } = await supabase
      .from('room_orders')
      .update({
        status,
        customer_message: statusMessages[status],
      })
      .eq('id', order.id)

    if (error) {
      console.error('Erro ao atualizar pedido:', error)
      setMessage('Nao foi possivel atualizar o status.')
      return
    }

    fetchOrders()
  }

  return (
    <div className="orders-manager">
      <header className="orders-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Pedidos feitos</h1>
          <p>{pendingCount} pedido(s) em aberto.</p>
        </div>
      </header>

      {message && <div className="orders-alert">{message}</div>}

      <section className="orders-grid">
        {orders.map((order) => (
          <article key={order.id} className={`order-card ${order.status}`}>
            <div className="order-card__top">
              <div>
                <h2>Quarto {order.room_number}</h2>
                <span>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <strong>{order.status}</strong>
            </div>

            <p><b>Paciente:</b> {order.patient_name}</p>
            <p><b>Telefone:</b> {order.phone}</p>

            <div className="order-items">
              {order.items?.map((item, index) => (
                <span key={`${order.id}-${index}`}>
                  {item.quantity}x {item.name} - R$ {(item.unit_price * item.quantity).toFixed(2)}
                </span>
              ))}
            </div>

            <p className="order-total">Total: R$ {Number(order.total_amount).toFixed(2)}</p>
            <p className="customer-message">
              Mensagem ao cliente: {order.customer_message || statusMessages[order.status]}
            </p>

            <div className="status-actions">
              <button onClick={() => updateStatus(order, 'recebido')}>Recebido</button>
              <button onClick={() => updateStatus(order, 'preparo')}>Preparo</button>
              <button onClick={() => updateStatus(order, 'pronto')}>Pronto</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
