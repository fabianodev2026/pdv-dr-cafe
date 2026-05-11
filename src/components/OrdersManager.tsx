import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './OrdersManager.css'

type OrderStatus = 'novo' | 'recebido' | 'preparo' | 'pronto' | 'entregue' | 'cancelado'
type OrderSource = 'mesa' | 'quarto' | 'comanda' | 'app'

interface OrderItem {
  name: string
  quantity: number
  unit_price: number
}

interface OrderTicket {
  id: number
  ids: number[]
  tableName: 'room_orders' | 'service_orders' | 'app_orders'
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

interface AppCustomer {
  id: number
  name: string
  phone: string
  position: string
  status: 'pendente' | 'ativo' | 'bloqueado'
  credit_limit: number
  pending_total?: number
}

const statusMessages: Record<OrderStatus, string> = {
  novo: 'Pedido enviado para o PDV.',
  recebido: 'Seu pedido foi recebido.',
  preparo: 'Seu pedido esta em preparo.',
  pronto: 'Seu pedido esta pronto para entrega.',
  entregue: 'Pedido entregue. Obrigado!',
  cancelado: 'Pedido cancelado pelo cafe.',
}

const closedStatuses: OrderStatus[] = ['entregue', 'cancelado']

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const toMoney = (value: number) => Number(value.toFixed(2))

const getFifthBusinessDay = () => {
  const now = new Date()
  const targetMonth = now.getMonth() + 1
  const date = new Date(now.getFullYear(), targetMonth, 1)
  let businessDays = 0

  while (businessDays < 5) {
    const weekDay = date.getDay()
    if (weekDay !== 0 && weekDay !== 6) businessDays += 1
    if (businessDays < 5) date.setDate(date.getDate() + 1)
  }

  return date.toISOString().slice(0, 10)
}

const mergeOpenOrders = (orders: OrderTicket[]) => {
  const groupedOrders = new Map<string, OrderTicket>()

  orders
    .filter((order) => !closedStatuses.includes(order.status))
    .forEach((order) => {
      const key = [
        order.tableName,
        order.source_type,
        order.service_number,
        order.customer_name?.trim().toLowerCase() ?? '',
      ].join('-')
      const current = groupedOrders.get(key)

      if (!current) {
        groupedOrders.set(key, { ...order, ids: order.ids.length > 0 ? order.ids : [order.id] })
        return
      }

      groupedOrders.set(key, {
        ...current,
        ids: [...current.ids, ...order.ids],
        items: [...current.items, ...order.items],
        total_amount: Number(current.total_amount || 0) + Number(order.total_amount || 0),
      })
    })

  return Array.from(groupedOrders.values())
}

export default function OrdersManager() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderTicket[]>([])
  const [appCustomers, setAppCustomers] = useState<AppCustomer[]>([])
  const [selectedAppCustomerByOrder, setSelectedAppCustomerByOrder] = useState<Record<string, string>>({})
  const [sendingToAppOrderId, setSendingToAppOrderId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [printOrder, setPrintOrder] = useState<OrderTicket | null>(null)

  const pendingCount = useMemo(
    () => orders.filter((order) => !closedStatuses.includes(order.status)).length,
    [orders],
  )

  const fetchOrders = async () => {
    const roomResult = await supabase
      .from('room_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (roomResult.error) {
      console.error('Erro ao buscar pedidos de quartos:', roomResult.error)
      setMessage(`Erro ao buscar pedidos de quartos: ${roomResult.error.message}`)
      return
    }

    const serviceResult = await supabase
      .from('service_orders')
      .select('*')
      .order('created_at', { ascending: false })

    const appResult = await supabase
      .from('app_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (serviceResult.error || appResult.error) {
      console.error('Erro ao buscar pedidos internos:', serviceResult.error)
      console.error('Erro ao buscar pedidos do app:', appResult.error)
      setMessage('Execute o SQL atualizado para pedidos de mesa e app.')
    } else {
      setMessage('')
    }

    const roomOrders: OrderTicket[] = (roomResult.data ?? []).map((order) => ({
      id: order.id,
      ids: [order.id],
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
      ids: [order.id],
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

    const appOrders: OrderTicket[] = (appResult.data ?? []).map((order) => ({
      id: order.id,
      ids: [order.id],
      tableName: 'app_orders',
      created_at: order.created_at,
      source_type: 'app',
      service_number: 0,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      items: order.items ?? [],
      total_amount: order.total_amount,
      status: order.status,
      customer_message: order.customer_message,
    }))

    setOrders(
      [
        ...mergeOpenOrders([...roomOrders, ...serviceOrders]),
        ...appOrders.filter((order) => !closedStatuses.includes(order.status)),
      ]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    )
  }

  const fetchAppCustomers = async () => {
    const customersResult = await supabase
      .from('app_customers')
      .select('id, name, phone, position, status, credit_limit')
      .eq('status', 'ativo')
      .order('name')

    if (customersResult.error) return

    const pendingResult = await supabase
      .from('pending_payments')
      .select('phone, total_amount')
      .eq('status', 'pendente')

    const pendingByPhone = (pendingResult.data ?? []).reduce<Record<string, number>>(
      (totals, payment) => {
        const phone = String(payment.phone || '')
        return {
          ...totals,
          [phone]: toMoney((totals[phone] ?? 0) + Number(payment.total_amount || 0)),
        }
      },
      {},
    )

    setAppCustomers(
      (customersResult.data ?? []).map((customer) => ({
        ...customer,
        pending_total: pendingByPhone[customer.phone] ?? 0,
      })),
    )
  }

  useEffect(() => {
    fetchOrders()
    fetchAppCustomers()
    const interval = window.setInterval(fetchOrders, 10000)

    return () => window.clearInterval(interval)
  }, [])

  const updateStatus = async (order: OrderTicket, status: OrderStatus) => {
    const targetIds = order.ids.length > 0 ? order.ids : [order.id]
    const { error } = await supabase
      .from(order.tableName)
      .update({
        status,
        customer_message: statusMessages[status],
      })
      .in('id', targetIds)

    if (error) {
      console.error('Erro ao atualizar pedido:', error)
      setMessage('Nao foi possivel atualizar o status.')
      return
    }

    fetchOrders()
  }

  const cancelOrder = async (order: OrderTicket) => {
    const confirmed = window.confirm(
      `Cancelar este pedido de ${order.source_type === 'app'
        ? 'app cliente'
        : `${order.source_type === 'mesa' ? 'mesa' : order.source_type === 'comanda' ? 'comanda' : 'quarto'} ${order.service_number}`
      }?`,
    )

    if (!confirmed) return
    await updateStatus(order, 'cancelado')
  }

  const openReprint = (order: OrderTicket) => {
    setPrintOrder(order)
  }

  const addItemsToService = (order: OrderTicket) => {
    const serviceType =
      order.source_type === 'comanda'
        ? 'command'
        : order.source_type === 'mesa'
          ? 'table'
          : 'room'

    navigate(serviceType === 'command' ? '/comandas' : '/mesas', {
      state: {
        reopenService: {
          type: serviceType,
          number: order.service_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          order_id: order.id,
          order_ids: order.ids,
          order_table: order.tableName === 'room_orders' ? 'room_orders' : 'service_orders',
          items: order.items,
        },
      },
    })
  }

  const sendOrderToAppCustomer = async (order: OrderTicket) => {
    const orderKey = `${order.tableName}-${order.id}`
    const selectedCustomerId = selectedAppCustomerByOrder[orderKey]
    const customer = appCustomers.find((appCustomer) => String(appCustomer.id) === selectedCustomerId)

    if (!customer) {
      setMessage('Escolha o cliente app para lancar esta compra.')
      return
    }

    const creditLimit = Number(customer.credit_limit || 0)
    const pendingTotal = Number(customer.pending_total || 0)
    const availableCredit = Math.max(creditLimit - pendingTotal, 0)
    const orderTotal = Number(order.total_amount || 0)

    if (creditLimit > 0 && orderTotal > availableCredit) {
      setMessage('Compra acima do saldo disponivel deste cliente app.')
      return
    }

    const confirmed = window.confirm(
      `Lancar ${currencyFormatter.format(orderTotal)} no app de ${customer.name}?`,
    )
    if (!confirmed) return

    setSendingToAppOrderId(orderKey)

    const itemsDetail = order.items
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - R$ ${(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}`,
      )
      .join('; ')

    const { error: pendingError } = await supabase.from('pending_payments').insert([
      {
        customer_name: customer.name,
        phone: customer.phone,
        position: customer.position,
        description: `Compra lancada pelo caixa em ${getOrderTitle(order)}`,
        items_detail: itemsDetail,
        total_amount: orderTotal,
        purchase_date: new Date().toISOString().slice(0, 10),
        due_date: getFifthBusinessDay(),
        status: 'pendente',
      },
    ])

    if (pendingError) {
      setSendingToAppOrderId(null)
      setMessage(`Nao foi possivel enviar para o app: ${pendingError.message}`)
      return
    }

    const targetIds = order.ids.length > 0 ? order.ids : [order.id]
    await supabase
      .from(order.tableName)
      .update({
        status: 'entregue',
        customer_message: `Compra lancada no app de ${customer.name}.`,
      })
      .in('id', targetIds)

    setSelectedAppCustomerByOrder((current) => ({
      ...current,
      [orderKey]: '',
    }))
    setSendingToAppOrderId(null)
    setMessage(`Compra lancada no app de ${customer.name}.`)
    fetchAppCustomers()
    fetchOrders()
  }

  const closeReprint = () => {
    document.body.classList.remove('printing-order-receipt')
    setPrintOrder(null)
  }

  const printSelectedOrder = () => {
    document.body.classList.add('printing-order-receipt')
    const clearPrintMode = () => {
      document.body.classList.remove('printing-order-receipt')
      window.removeEventListener('focus', clearPrintMode)
    }

    window.addEventListener('focus', clearPrintMode)
    window.print()
    window.setTimeout(clearPrintMode, 1200)
  }

  const getOrderTitle = (order: OrderTicket) => (
    order.source_type === 'app'
      ? 'App cliente'
      : `${order.source_type === 'mesa' ? 'Mesa' : order.source_type === 'comanda' ? 'Comanda' : 'Quarto'} ${order.service_number}`
  )

  return (
    <div className="orders-manager">
      <header className="orders-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Ultimos pedidos feitos</h1>
          <p>{pendingCount} pedido(s) em aberto.</p>
        </div>
        <button onClick={fetchOrders} className="orders-refresh">
          Atualizar
        </button>
      </header>

      {message && <div className="orders-alert">{message}</div>}

      <section className="orders-grid">
        {orders.length === 0 && (
          <p className="orders-empty">Nenhum pedido encontrado ainda.</p>
        )}
        {orders.map((order) => (
          <article
            key={`${order.tableName}-${order.id}`}
            className={`order-card ${order.status}`}
          >
            <div className="order-card__top">
              <div>
                <h2>
                  {order.source_type === 'app'
                    ? 'App cliente'
                    : `${order.source_type === 'mesa' ? 'Mesa' : order.source_type === 'comanda' ? 'Comanda' : 'Quarto'} ${order.service_number}`}
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
              <button
                onClick={() => openReprint(order)}
                className="btn-reprint-order"
              >
                Reimprimir
              </button>
              {order.source_type !== 'app' && (
                <button
                  onClick={() => addItemsToService(order)}
                  className="btn-add-command-items"
                >
                  Adicionar itens
                </button>
              )}
              {order.source_type !== 'app' && (
                <div className="send-to-app-control">
                  <select
                    value={selectedAppCustomerByOrder[`${order.tableName}-${order.id}`] ?? ''}
                    onChange={(event) =>
                      setSelectedAppCustomerByOrder((current) => ({
                        ...current,
                        [`${order.tableName}-${order.id}`]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Cliente app</option>
                    {appCustomers.map((customer) => {
                      const available = Math.max(
                        Number(customer.credit_limit || 0) -
                          Number(customer.pending_total || 0),
                        0,
                      )

                      return (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {currencyFormatter.format(available)}
                        </option>
                      )
                    })}
                  </select>
                  <button
                    type="button"
                    className="btn-send-to-app"
                    onClick={() => sendOrderToAppCustomer(order)}
                    disabled={sendingToAppOrderId === `${order.tableName}-${order.id}`}
                  >
                    {sendingToAppOrderId === `${order.tableName}-${order.id}`
                      ? 'Enviando...'
                      : 'Enviar para app'}
                  </button>
                </div>
              )}
              <button onClick={() => updateStatus(order, 'recebido')}>Recebido</button>
              <button onClick={() => updateStatus(order, 'preparo')}>Preparo</button>
              <button onClick={() => updateStatus(order, 'pronto')}>Pronto</button>
              {order.status === 'pronto' && (
                <button
                  onClick={() => updateStatus(order, 'entregue')}
                  className="btn-delivered"
                >
                  Entregue
                </button>
              )}
              <button
                onClick={() => cancelOrder(order)}
                className="btn-cancel-order"
              >
                Cancelar pedido
              </button>
            </div>
          </article>
        ))}
      </section>

      {printOrder && (
        <>
          <div className="order-print-modal no-print">
            <div className="order-print-card">
              <h2>Reimprimir pedido</h2>
              <p>{getOrderTitle(printOrder)}</p>
              <div className="order-print-actions">
                <button onClick={printSelectedOrder}>Imprimir</button>
                <button onClick={closeReprint}>Fechar</button>
              </div>
            </div>
          </div>

          <div className="order-print-receipt">
            <div className="order-print-header">
              <img src="/logo.jpeg" alt="Dr. Cafe" />
              <h2>DR. CAFE</h2>
              <p>
                <strong>REIMPRESSAO DE PEDIDO</strong>
              </p>
            </div>
            <div className="order-print-section">
              <h3>{getOrderTitle(printOrder)}</h3>
              <p>Pedido: #{printOrder.id}</p>
              <p>Data: {new Date(printOrder.created_at).toLocaleString('pt-BR')}</p>
              {printOrder.customer_name && <p>Cliente: {printOrder.customer_name}</p>}
              {printOrder.customer_phone && <p>Telefone: {printOrder.customer_phone}</p>}
            </div>
            <table className="order-print-table">
              <tbody>
                {printOrder.items.map((item, index) => (
                  <tr key={`${printOrder.tableName}-${printOrder.id}-print-${index}`}>
                    <td>{item.quantity}</td>
                    <td>{item.name}</td>
                    <td>R$ {(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="order-print-footer">
              <p>Status: {printOrder.status}</p>
              <h3>TOTAL: R$ {Number(printOrder.total_amount).toFixed(2)}</h3>
            </div>
            <div className="order-print-feed" aria-hidden="true">
              <span>&nbsp;</span>
              <span>&nbsp;</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
