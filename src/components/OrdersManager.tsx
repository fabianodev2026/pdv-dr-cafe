import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ADMIN_ROLES, hasRole, type CurrentUser } from '../lib/rolePermissions'
import './OrdersManager.css'

type OrderStatus = 'novo' | 'recebido' | 'preparo' | 'pronto' | 'pago' | 'entregue' | 'cancelado'
type OrderSource = 'mesa' | 'quarto' | 'comanda' | 'app'
type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro'

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

interface SaleRecord {
  id: number
  created_at: string
  table_number?: number | null
  total_amount: number
  cashier_name?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  items?: Array<{
    name?: string
    quantity?: number
    unit_price?: number
    price?: number
    total?: number
  }>
  payment_method?: string | null
}

interface OrdersManagerProps {
  currentUser?: CurrentUser | null
}

const statusMessages: Record<OrderStatus, string> = {
  novo: 'Pedido enviado para o PDV.',
  recebido: 'Seu pedido foi recebido.',
  preparo: 'Seu pedido esta em preparo.',
  pronto: 'Seu pedido esta pronto para entrega.',
  pago: 'Pagamento registrado. Seu pedido sera finalizado na entrega.',
  entregue: 'Pedido entregue. Obrigado!',
  cancelado: 'Pedido cancelado pelo cafe.',
}

const closedStatuses: OrderStatus[] = ['entregue', 'cancelado']

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

export default function OrdersManager({ currentUser }: OrdersManagerProps) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderTicket[]>([])
  const [appCustomers, setAppCustomers] = useState<AppCustomer[]>([])
  const [selectedAppCustomerByOrder, setSelectedAppCustomerByOrder] = useState<Record<string, string>>({})
  const [selectedAppItemIndexesByOrder, setSelectedAppItemIndexesByOrder] = useState<Record<string, number[]>>({})
  const [selectedPaymentByOrder, setSelectedPaymentByOrder] = useState<Record<string, PaymentMethod>>({})
  const [sendingToAppOrderId, setSendingToAppOrderId] = useState<string | null>(null)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [showOrderLog, setShowOrderLog] = useState(false)
  const [orderLog, setOrderLog] = useState<SaleRecord[]>([])
  const [orderLogDate, setOrderLogDate] = useState(getLocalDateInputValue())
  const [isLoadingOrderLog, setIsLoadingOrderLog] = useState(false)
  const [message, setMessage] = useState('')
  const [printOrder, setPrintOrder] = useState<OrderTicket | null>(null)

  const pendingCount = useMemo(
    () => orders.filter((order) => !closedStatuses.includes(order.status)).length,
    [orders],
  )
  const isAdmin = Boolean(currentUser && hasRole(currentUser, ADMIN_ROLES))

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

  const deleteAppOrder = async (order: OrderTicket) => {
    if (!isAdmin || order.source_type !== 'app') return

    const confirmed = window.confirm(
      `Apagar definitivamente o pedido do app de ${order.customer_name}? A pendencia financeira deste pedido tambem sera removida se ainda estiver em aberto.`,
    )
    if (!confirmed) return

    const purchaseDate = getLocalDateInputValue(new Date(order.created_at))
    const itemsDetail = order.items
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - R$ ${(Number(item.unit_price || 0) * Number(item.quantity || 0)).toFixed(2)}`,
      )
      .join('; ')

    const { error: pendingError } = await supabase
      .from('pending_payments')
      .delete()
      .eq('phone', order.customer_phone)
      .eq('purchase_date', purchaseDate)
      .eq('status', 'pendente')
      .eq('description', 'Compra pelo app Dr. Cafe')
      .eq('items_detail', itemsDetail)

    if (pendingError) {
      setMessage(`Nao foi possivel remover a pendencia do app: ${pendingError.message}`)
      return
    }

    const targetIds = order.ids.length > 0 ? order.ids : [order.id]
    const { error } = await supabase.from('app_orders').delete().in('id', targetIds)

    if (error) {
      setMessage(`Nao foi possivel apagar o pedido do app: ${error.message}`)
      return
    }

    setMessage(`Pedido do app de ${order.customer_name} apagado.`)
    fetchOrders()
    fetchAppCustomers()
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
    const selectedIndexes =
      selectedAppItemIndexesByOrder[orderKey] ?? order.items.map((_, index) => index)
    const selectedItems = order.items.filter((_, index) => selectedIndexes.includes(index))
    const remainingItems = order.items.filter((_, index) => !selectedIndexes.includes(index))

    if (!customer) {
      setMessage('Escolha o cliente app para lancar esta compra.')
      return
    }

    if (selectedItems.length === 0) {
      setMessage('Escolha pelo menos um item para enviar ao cliente app.')
      return
    }

    const creditLimit = Number(customer.credit_limit || 0)
    const pendingTotal = Number(customer.pending_total || 0)
    const availableCredit = Math.max(creditLimit - pendingTotal, 0)
    const selectedTotal = toMoney(
      selectedItems.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0,
      ),
    )
    const remainingTotal = toMoney(
      remainingItems.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0,
      ),
    )

    if (creditLimit > 0 && selectedTotal > availableCredit) {
      setMessage('Compra acima do saldo disponivel deste cliente app.')
      return
    }

    const confirmed = window.confirm(
      `Lancar ${currencyFormatter.format(selectedTotal)} no app de ${customer.name}?`,
    )
    if (!confirmed) return

    setSendingToAppOrderId(orderKey)

    const itemsDetail = selectedItems
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - R$ ${(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}`,
      )
      .join('; ')
    const saleItems = selectedItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total: toMoney(Number(item.unit_price || 0) * Number(item.quantity || 0)),
    }))

    const { error: pendingError } = await supabase.from('pending_payments').insert([
      {
        customer_name: customer.name,
        phone: customer.phone,
        position: customer.position,
        description: `Compra lancada pelo caixa em ${getOrderTitle(order)}`,
        items_detail: itemsDetail,
        total_amount: selectedTotal,
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

    const { error: saleError } = await supabase.from('sales').insert([
      {
        table_number: order.service_number || null,
        total_amount: selectedTotal,
        cashier_name: currentUser?.username ?? 'PDV',
        customer_name: customer.name,
        customer_phone: customer.phone,
        items: saleItems,
        payment_method: 'cliente_app',
      },
    ])

    if (saleError) {
      setSendingToAppOrderId(null)
      setMessage(`Compra enviada ao app, mas nao entrou no relatorio: ${saleError.message}`)
      return
    }

    const targetIds = order.ids.length > 0 ? order.ids : [order.id]
    if (remainingItems.length > 0) {
      await supabase
        .from(order.tableName)
        .update({
          items: remainingItems,
          total_amount: remainingTotal,
          customer_message: `Parte da compra foi lancada no app de ${customer.name}.`,
        })
        .eq('id', order.id)

      const duplicateIds = targetIds.filter((id) => id !== order.id)
      if (duplicateIds.length > 0) {
        await supabase
          .from(order.tableName)
          .update({
            status: 'cancelado',
            customer_message: 'Pedido unificado no lancamento parcial.',
          })
          .in('id', duplicateIds)
      }
    } else {
      await supabase
        .from(order.tableName)
        .update({
          status: 'entregue',
          customer_message: `Compra lancada no app de ${customer.name}.`,
        })
        .in('id', targetIds)
    }

    setSelectedAppCustomerByOrder((current) => ({
      ...current,
      [orderKey]: '',
    }))
    setSelectedAppItemIndexesByOrder((current) => ({
      ...current,
      [orderKey]: remainingItems.map((_, index) => index),
    }))
    setSendingToAppOrderId(null)
    setMessage(
      remainingItems.length > 0
        ? `Itens selecionados lancados no app de ${customer.name}. O restante continua na comanda.`
        : `Compra lancada no app de ${customer.name}.`,
    )
    fetchAppCustomers()
    fetchOrders()
  }

  const paySentOrder = async (order: OrderTicket) => {
    const orderKey = `${order.tableName}-${order.id}`
    const paymentMethod = selectedPaymentByOrder[orderKey] ?? 'pix'
    const confirmed = window.confirm(
      `Registrar pagamento de ${currencyFormatter.format(Number(order.total_amount || 0))} em ${getOrderTitle(order)}?`,
    )
    if (!confirmed) return

    setPayingOrderId(orderKey)

    const saleItems = order.items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total: toMoney(Number(item.unit_price || 0) * Number(item.quantity || 0)),
    }))

    const { error: saleError } = await supabase.from('sales').insert([
      {
        table_number: order.service_number || null,
        total_amount: Number(order.total_amount || 0),
        cashier_name: currentUser?.username ?? 'PDV',
        customer_name: order.customer_name || null,
        customer_phone: order.customer_phone || null,
        items: saleItems,
        payment_method: paymentMethod,
      },
    ])

    if (saleError) {
      setPayingOrderId(null)
      setMessage(`Nao foi possivel registrar pagamento: ${saleError.message}`)
      return
    }

    const targetIds = order.ids.length > 0 ? order.ids : [order.id]
    const { error: statusError } = await supabase
      .from(order.tableName)
      .update({
        status: 'pago',
        customer_message: statusMessages.pago,
      })
      .in('id', targetIds)

    setPayingOrderId(null)

    if (statusError) {
      setMessage(`Pagamento registrado, mas nao foi possivel finalizar pedido: ${statusError.message}`)
      return
    }

    setMessage(`Pagamento registrado em ${getOrderTitle(order)}. Clique em Entregue para fechar.`)
    fetchOrders()
  }

  const fetchOrderLog = async (dateValue = orderLogDate) => {
    const selectedDate = dateValue || getLocalDateInputValue()
    const startDate = new Date(`${selectedDate}T00:00:00`)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)

    setOrderLogDate(selectedDate)
    setIsLoadingOrderLog(true)
    setShowOrderLog(true)
    const { data, error } = await supabase
      .from('sales')
      .select('id, created_at, table_number, total_amount, cashier_name, customer_name, customer_phone, items, payment_method')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    setIsLoadingOrderLog(false)

    if (error) {
      setMessage(`Nao foi possivel buscar registro de pedidos: ${error.message}`)
      return
    }

    setOrderLog(data ?? [])
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
        <button onClick={() => fetchOrderLog(getLocalDateInputValue())} className="orders-log-button">
          Registro de pedidos
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
                <div className="order-payment-control">
                  <label>Pagamento</label>
                  <select
                    value={selectedPaymentByOrder[`${order.tableName}-${order.id}`] ?? 'pix'}
                    onChange={(event) =>
                      setSelectedPaymentByOrder((current) => ({
                        ...current,
                        [`${order.tableName}-${order.id}`]: event.target.value as PaymentMethod,
                      }))
                    }
                  >
                    <option value="pix">Pix</option>
                    <option value="credito">Cartao de credito</option>
                    <option value="debito">Cartao de debito</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                  <button
                    type="button"
                    className="btn-pay-order"
                    onClick={() => paySentOrder(order)}
                    disabled={payingOrderId === `${order.tableName}-${order.id}`}
                  >
                    {payingOrderId === `${order.tableName}-${order.id}`
                      ? 'Registrando...'
                      : 'Registrar pagamento'}
                  </button>
                </div>
              )}
              {order.source_type !== 'app' && (
                <div className="send-to-app-control">
                  <div className="send-to-app-items">
                    <strong>Enviar quais itens?</strong>
                    {order.items.map((item, index) => {
                      const orderKey = `${order.tableName}-${order.id}`
                      const selectedIndexes =
                        selectedAppItemIndexesByOrder[orderKey] ??
                        order.items.map((_, itemIndex) => itemIndex)

                      return (
                        <label key={`${orderKey}-app-item-${index}`}>
                          <input
                            type="checkbox"
                            checked={selectedIndexes.includes(index)}
                            onChange={(event) =>
                              setSelectedAppItemIndexesByOrder((current) => {
                                const currentIndexes =
                                  current[orderKey] ??
                                  order.items.map((_, itemIndex) => itemIndex)
                                const nextIndexes = event.target.checked
                                  ? [...currentIndexes, index]
                                  : currentIndexes.filter((itemIndex) => itemIndex !== index)

                                return {
                                  ...current,
                                  [orderKey]: Array.from(new Set(nextIndexes)).sort(
                                    (a, b) => a - b,
                                  ),
                                }
                              })
                            }
                          />
                          <span>
                            {item.quantity}x {item.name} - R${' '}
                            {(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}
                          </span>
                        </label>
                      )
                    })}
                    {(() => {
                      const orderKey = `${order.tableName}-${order.id}`
                      const selectedIndexes =
                        selectedAppItemIndexesByOrder[orderKey] ??
                        order.items.map((_, itemIndex) => itemIndex)
                      const selectedCustomerId = selectedAppCustomerByOrder[orderKey]
                      const selectedCustomer = appCustomers.find(
                        (customer) => String(customer.id) === selectedCustomerId,
                      )
                      const selectedTotal = toMoney(
                        order.items
                          .filter((_, itemIndex) => selectedIndexes.includes(itemIndex))
                          .reduce(
                            (sum, item) =>
                              sum +
                              Number(item.unit_price || 0) * Number(item.quantity || 0),
                            0,
                          ),
                      )
                      const remainingTotal = Math.max(
                        Number(order.total_amount || 0) - selectedTotal,
                        0,
                      )
                      const customerAvailable = selectedCustomer
                        ? Math.max(
                            Number(selectedCustomer.credit_limit || 0) -
                              Number(selectedCustomer.pending_total || 0),
                            0,
                          )
                        : 0
                      const customerAfter = selectedCustomer
                        ? Math.max(customerAvailable - selectedTotal, 0)
                        : 0

                      return (
                        <div className="send-to-app-summary">
                          <span>Vai para o app: {currencyFormatter.format(selectedTotal)}</span>
                          <span>Resta na comanda: {currencyFormatter.format(remainingTotal)}</span>
                          {selectedCustomer && (
                            <span>
                              Saldo do cliente depois:{' '}
                              {currencyFormatter.format(customerAfter)}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
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
              {(order.status === 'pronto' || order.status === 'pago') && (
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
              {isAdmin && order.source_type === 'app' && (
                <button
                  type="button"
                  onClick={() => deleteAppOrder(order)}
                  className="btn-delete-app-order"
                >
                  Apagar pedido
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {showOrderLog && (
        <div className="orders-log-overlay">
          <div className="orders-log-panel">
            <div className="orders-log-heading">
              <div>
                <h2>Registro de pedidos</h2>
                <p>Historico do que foi lancado no caixa neste dia.</p>
              </div>
              <button type="button" onClick={() => setShowOrderLog(false)}>
                Fechar
              </button>
            </div>
            <div className="orders-log-filter">
              <label>
                Data
                <input
                  type="date"
                  value={orderLogDate}
                  onChange={(event) => setOrderLogDate(event.target.value)}
                />
              </label>
              <button type="button" onClick={() => fetchOrderLog(orderLogDate)}>
                Buscar data
              </button>
            </div>
            {isLoadingOrderLog ? (
              <p className="orders-empty">Carregando registros...</p>
            ) : orderLog.length === 0 ? (
              <p className="orders-empty">Nenhum registro encontrado.</p>
            ) : (
              <div className="orders-log-list">
                {orderLog.map((sale) => (
                  <article key={sale.id} className="orders-log-card">
                    <div>
                      <strong>{new Date(sale.created_at).toLocaleString('pt-BR')}</strong>
                      <span>
                        {sale.payment_method === 'cliente_app'
                          ? 'Lancado no app'
                          : `Pagamento: ${sale.payment_method || '-'}`}
                      </span>
                      <span>Cliente: {sale.customer_name || '-'}</span>
                      {sale.customer_phone && <span>Telefone: {sale.customer_phone}</span>}
                      <span>Atendimento: {sale.table_number ? `#${sale.table_number}` : '-'}</span>
                      <span>Caixa: {sale.cashier_name || '-'}</span>
                    </div>
                    <div className="orders-log-items">
                      {(sale.items ?? []).map((item, index) => {
                        const quantity = Number(item.quantity || 0)
                        const unitPrice = Number(item.unit_price ?? item.price ?? 0)
                        const total = Number(item.total ?? quantity * unitPrice)
                        return (
                          <span key={`${sale.id}-item-${index}`}>
                            {quantity}x {item.name || 'Item'} - {currencyFormatter.format(total)}
                          </span>
                        )
                      })}
                    </div>
                    <b>Total: {currencyFormatter.format(Number(sale.total_amount || 0))}</b>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
