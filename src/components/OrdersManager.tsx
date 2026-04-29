import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './OrdersManager.css'

type OrderStatus = 'novo' | 'recebido' | 'preparo' | 'pronto'
type OrderSource = 'mesa' | 'quarto'

interface OrderItem {
  name: string
  quantity: number
  unit_price: number
}

interface OrderTicket {
  id: number
  tableName: 'room_orders' | 'service_orders'
  created_at: string
  source_type: OrderSource
  service_number: number
  customer_name: string
  customer_phone: string
  items: OrderItem[]
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
  const [orders, setOrders] = useState<OrderTicket[]>([])
  const [message, setMessage] = useState('')

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status !== 'pronto').length,
    [orders],
  )

  const fetchOrders = async () => {
    const [roomResult, serviceResult] = await Promise.all([
      supabase.from('room_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
    ])

    if (roomResult.error) {
      console.error('Erro ao buscar pedidos de quartos:', roomResult.error)
      setMessage('Execute o SQL atualizado para criar e liberar os pedidos.')
      return
    }

    if (serviceResult.error) {
      console.error('Erro ao buscar pedidos internos:', serviceResult.error)
      setMessage('Execute o SQL orders-products-fixes para pedidos de mesa.')
    } else {
      setMessage('')
    }

    const roomOrders: OrderTicket[] = (roomResult.data ?? []).map((order) => ({
      id: order.id,
      tableName: 'room_orders',
      created_at: order.created_at,
      source_type: 'quarto',
      service_number: order.room_number,
      customer_name: order.patient_name,
      customer_phone: order.phone,
      items: order.items ?? [],
      total_amount: order.total_amount,
      status: order.status,
      customer_message: order.customer_message,
    }))

    const serviceOrders: OrderTicket[] = (serviceResult.data ?? []).map((order) => ({
      id: order.id,
      tableName: 'service_orders',
      created_at: order.created_at,
      source_type: order.source_type,
      service_number: order.service_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      items: order.items ?? [],
      total_amount: order.total_amount,
      status: order.status,
      customer_message: order.customer_message,
    }))

    setOrders(
      [...roomOrders, ...serviceOrders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    )
  }

  useEffect(() => {
    fetchOrders()
    const interval = window.setInterval(fetchOrders, 10000)

    return () => window.clearInterval(interval)
  }, [])

  const updateStatus = async (order: OrderTicket, status: OrderStatus) => {
    const { error } = await supabase
      .from(order.tableName)
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
          <article
            key={`${order.tableName}-${order.id}`}
            className={`order-card ${order.status}`}
          >
            <div className="order-card__top">
              <div>
                <h2>
                  {order.source_type === 'mesa' ? 'Mesa' : 'Quarto'}{' '}
                  {order.service_number}
                </h2>
                <span>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <strong>{order.status}</strong>
            </div>

            {order.customer_name && <p><b>Cliente:</b> {order.customer_name}</p>}
            {order.customer_phone && <p><b>Telefone:</b> {order.customer_phone}</p>}

            <div className="order-items">
              {order.items?.map((item, index) => (
                <span key={`${order.tableName}-${order.id}-${index}`}>
                  {item.quantity}x {item.name} - R${' '}
                  {(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}
                </span>
              ))}
            </div>

            <p className="order-total">
              Total: R$ {Number(order.total_amount).toFixed(2)}
            </p>
            <p className="customer-message">
              Mensagem ao cliente:{' '}
              {order.customer_message || statusMessages[order.status]}
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
