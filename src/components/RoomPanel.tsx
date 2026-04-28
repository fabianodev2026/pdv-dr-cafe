import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './RoomPanel.css'

interface OrderItem {
  id: number
  name: string
  quantity: number
}

interface RoomOrder {
  id: number
  created_at: string
  table_number: number
  customer_name: string
  customer_phone?: string
  items: OrderItem[]
  delivered: boolean
}

export default function RoomPanel() {
  const [roomOrders, setRoomOrders] = useState<RoomOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRoomOrders = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .is('delivered', false)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        setRoomOrders(
          data.filter((sale: any) => sale.customer_name && sale.customer_name.trim() !== '')
        )
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos:', (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsDelivered = async (orderId: number) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ delivered: true })
        .eq('id', orderId)

      if (error) throw error

      fetchRoomOrders()
    } catch (err) {
      alert('Erro ao atualizar entrega: ' + (err as Error).message)
    }
  }

  useEffect(() => {
    fetchRoomOrders()
    const interval = setInterval(fetchRoomOrders, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="room-panel-container">
      <header className="header">
        <h1 className="title">🏥 Painel de Expedição - Quartos</h1>
        <button onClick={fetchRoomOrders} className="btn-refresh">
          🔄 Atualizar Agora
        </button>
      </header>

      {isLoading && roomOrders.length === 0 ? (
        <div className="loading">Buscando pedidos pendentes...</div>
      ) : roomOrders.length === 0 ? (
        <div className="empty-state">
          Ufa! Nenhum pedido pendente para entrega no momento. ✅
        </div>
      ) : (
        <div className="orders-grid">
          {roomOrders.map((order) => (
            <div key={order.id} className="order-card glass-panel">
              <div className="order-header">
                <h2>Quarto {order.table_number}</h2>
                <span className="time">
                  {new Date(order.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="patient-info">
                <p>
                  <strong>👤 Paciente:</strong> {order.customer_name}
                </p>
                {order.customer_phone && (
                  <p>
                    <strong>📞 Ramal:</strong> {order.customer_phone}
                  </p>
                )}
              </div>

              <hr className="divider" />

              <ul className="items-list">
                {order.items &&
                  order.items.map((item: any) => (
                    <li key={item.id}>
                      <span className="qty">{item.quantity}x</span> {item.name}
                    </li>
                  ))}
              </ul>

              <button
                onClick={() => markAsDelivered(order.id)}
                className="btn-deliver"
              >
                ✅ Marcar como Entregue
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
