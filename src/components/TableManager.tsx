import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { createFiscalPayload, formatCpf, isCompleteCpf, queueFiscalPayload } from '../lib/fiscalService'
import { logAppError } from '../lib/appLogger'
import { queueOfflineRecord, queueOfflineSale } from '../lib/offlineQueue'
import { markBackupNeededAfterClosing } from '../lib/backupService'
import { openCashDrawer } from '../lib/cashDrawerService'
import { readReceiptPrinterSettings, type ReceiptPrinterSettings } from '../lib/printerSettings'
import './TableManager.css'

interface Product {
  id: number
  name: string
  unit_price: number
  image_url?: string
  barcode?: string
  description?: string
  category?: string
  stock_quantity?: number
  low_stock_threshold?: number
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

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  total: number
  sent_to_preparation?: boolean
}

type ServiceType = 'table' | 'room' | 'command'
type ViewMode = 'salon' | 'hospital' | 'commands'
type ProductTab = 'todos' | 'bebidas' | 'comidas' | 'presentes'

interface TableItem {
  id: number
  number: number
  type: ServiceType
  status: 'Livre' | 'Ocupada'
  total: number
  items: OrderItem[]
  customer_name: string
  customer_phone: string
  preparation_order_id?: number
  preparation_order_ids?: number[]
  preparation_order_table?: 'service_orders' | 'room_orders'
}

interface ReceiptData {
  type: ServiceType
  number: number
  items: OrderItem[]
  total: number
  customer_name: string
  customer_phone: string
  date: string
  payment_method: PaymentMethod
  app_customer_id?: number
  app_customer_position?: string
  fiscal_cpf: string
  fiscal_qr_text: string
}

type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'pagar_depois' | 'cliente_app'

interface CurrentUser {
  username: string
  role: string
}

interface TableManagerProps {
  currentUser?: CurrentUser
  initialViewMode?: ViewMode
}

interface ReopenServiceState {
  reopenService?: {
    type: ServiceType
    number: number
    customer_name?: string
    customer_phone?: string
    order_id?: number
    order_ids?: number[]
    order_table?: 'service_orders' | 'room_orders'
    items?: Array<{
      name: string
      quantity: number
      unit_price: number
    }>
  }
}

const LAST_RECEIPT_KEY = 'dr-cafe-last-receipt'

const createServiceItem = (number: number, type: ServiceType): TableItem => ({
  id: type === 'table' ? number : type === 'room' ? 1000 + number : 2000 + number,
  number,
  type,
  status: 'Livre',
  total: 0,
  items: [],
  customer_name: '',
  customer_phone: '',
})

const initialTables: TableItem[] = Array.from({ length: 6 }, (_, index) =>
  createServiceItem(index + 1, 'table'),
)

const roomNumbers = [
  ...Array.from({ length: 7 }, (_, index) => 101 + index),
  ...Array.from({ length: 11 }, (_, index) => 201 + index),
  ...Array.from({ length: 15 }, (_, index) => 301 + index),
]

const initialRooms: TableItem[] = roomNumbers.map((number) =>
  createServiceItem(number, 'room'),
)

const initialCommands: TableItem[] = Array.from({ length: 12 }, (_, index) =>
  createServiceItem(index + 1, 'command'),
)

const getServiceLabel = (item: Pick<TableItem | ReceiptData, 'type' | 'number'>) => {
  if (item.type === 'room') return `Quarto ${item.number}`
  if (item.type === 'command') return `Comanda ${item.number}`
  return `Mesa ${item.number}`
}

const getServiceSource = (type: ServiceType) => {
  if (type === 'room') return 'quarto'
  if (type === 'command') return 'comanda'
  return 'mesa'
}

const getItemReset = (item: TableItem): TableItem => ({
  ...item,
  items: [],
  total: 0,
  status: 'Livre',
  customer_name: '',
  customer_phone: '',
  preparation_order_id: undefined,
  preparation_order_ids: undefined,
  preparation_order_table: undefined,
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

const createFiscalQrText = (receipt: Omit<ReceiptData, 'fiscal_qr_text'>) => {
  if (!receipt.fiscal_cpf || !isCompleteCpf(receipt.fiscal_cpf)) return ''

  return [
    'DR CAFE',
    'NOTA FISCAL PAULISTA',
    `CPF=${receipt.fiscal_cpf}`,
    `TOTAL=${receipt.total.toFixed(2)}`,
    `PAGAMENTO=${receipt.payment_method}`,
    `ATENDIMENTO=${receipt.type}-${receipt.number}`,
    `DATA=${receipt.date}`,
    'STATUS=PENDENTE_EMISSAO_FISCAL',
  ].join('|')
}

export default function TableManager({
  currentUser,
  initialViewMode = 'salon',
}: TableManagerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [tables, setTables] = useState<TableItem[]>(initialTables)
  const [rooms, setRooms] = useState<TableItem[]>(initialRooms)
  const [commands, setCommands] = useState<TableItem[]>(initialCommands)
  const [activeItem, setActiveItem] = useState<TableItem | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isReprint, setIsReprint] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_RECEIPT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [printerSettings, setPrinterSettings] = useState<ReceiptPrinterSettings>(() =>
    readReceiptPrinterSettings(),
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [payLaterDueDate, setPayLaterDueDate] = useState('')
  const [appCustomers, setAppCustomers] = useState<AppCustomer[]>([])
  const [selectedAppCustomerId, setSelectedAppCustomerId] = useState('')
  const [fiscalCpf, setFiscalCpf] = useState('')
  const [selectedFloor, setSelectedFloor] = useState('todos')
  const [roomSearch, setRoomSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productTab, setProductTab] = useState<ProductTab>('todos')
  const [orderMessage, setOrderMessage] = useState('')

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setAvailableProducts(data)
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

  const markServiceOccupied = (
    current: TableItem[],
    service: TableItem,
  ) => {
    const exists = current.some((item) => item.id === service.id)
    if (!exists) return [...current, service]

    return current.map((item) =>
      item.id === service.id && item.status === 'Livre' ? service : item,
    )
  }

  const buildItemsFromPreparation = (
    items: Array<{ name: string; quantity: number; unit_price: number }> = [],
  ) =>
    items.map((item, index) => {
      const quantity = Number(item.quantity || 1)
      const price = Number(item.unit_price || 0)
      return {
        id: Date.now() + index,
        name: item.name,
        price,
        quantity,
        total: toMoney(price * quantity),
        sent_to_preparation: true,
      }
    })

  const fetchOpenPreparationServices = async () => {
    const serviceResult = await supabase
      .from('service_orders')
      .select('*')
      .not('status', 'in', '("entregue","cancelado")')
      .order('created_at', { ascending: false })

    if (!serviceResult.error) {
      const openServices = new Map<string, TableItem>()

      ;(serviceResult.data ?? []).forEach((order) => {
        const serviceType =
          order.source_type === 'comanda'
            ? 'command'
            : order.source_type === 'mesa'
              ? 'table'
              : null
        if (!serviceType) return

        const key = `${serviceType}-${order.service_number}`
        const orderItems = buildItemsFromPreparation(order.items ?? [])
        const current = openServices.get(key)

        if (!current) {
          openServices.set(key, {
            ...createServiceItem(order.service_number, serviceType),
            status: 'Ocupada',
            customer_name: order.customer_name || '',
            customer_phone: order.customer_phone || '',
            preparation_order_id: order.id,
            preparation_order_ids: [order.id],
            preparation_order_table: 'service_orders',
            items: orderItems,
            total: toMoney(Number(order.total_amount || 0)),
          })
          return
        }

        openServices.set(key, {
          ...current,
          preparation_order_ids: [...(current.preparation_order_ids ?? []), order.id],
          items: [...current.items, ...orderItems],
          total: toMoney(current.total + Number(order.total_amount || 0)),
        })
      })

      const openTables = Array.from(openServices.values()).filter(
        (service) => service.type === 'table',
      )
      const openCommands = Array.from(openServices.values()).filter(
        (service) => service.type === 'command',
      )

      setTables((current) =>
        openTables.reduce((next, service) => markServiceOccupied(next, service), current),
      )
      setCommands((current) =>
        openCommands.reduce((next, service) => markServiceOccupied(next, service), current),
      )
    }

    const roomResult = await supabase
      .from('room_orders')
      .select('*')
      .not('status', 'in', '("entregue","cancelado")')
      .order('created_at', { ascending: false })

    if (!roomResult.error) {
      const openRooms = new Map<number, TableItem>()

      ;(roomResult.data ?? []).forEach((order) => {
        const roomNumber = Number(order.room_number || 0)
        if (!roomNumber) return

        const orderItems = buildItemsFromPreparation(order.items ?? [])
        const current = openRooms.get(roomNumber)

        if (!current) {
          openRooms.set(roomNumber, {
            ...createServiceItem(roomNumber, 'room'),
            status: 'Ocupada',
            customer_name: order.patient_name || '',
            customer_phone: order.phone || '',
            preparation_order_id: order.id,
            preparation_order_ids: [order.id],
            preparation_order_table: 'room_orders',
            items: orderItems,
            total: toMoney(Number(order.total_amount || 0)),
          })
          return
        }

        openRooms.set(roomNumber, {
          ...current,
          preparation_order_ids: [...(current.preparation_order_ids ?? []), order.id],
          items: [...current.items, ...orderItems],
          total: toMoney(current.total + Number(order.total_amount || 0)),
        })
      })

      setRooms((current) =>
        Array.from(openRooms.values()).reduce(
          (next, service) => markServiceOccupied(next, service),
          current,
        ),
      )
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchAppCustomers()
    fetchOpenPreparationServices()
  }, [])

  useEffect(() => {
    const state = location.state as ReopenServiceState | null
    const serviceToReopen = state?.reopenService
    if (!serviceToReopen) return

    const reopenedItem: TableItem = {
      ...createServiceItem(serviceToReopen.number, serviceToReopen.type),
      status: 'Ocupada',
      customer_name: serviceToReopen.customer_name || '',
      customer_phone: serviceToReopen.customer_phone || '',
      preparation_order_id: serviceToReopen.order_id,
      preparation_order_ids: serviceToReopen.order_ids,
      preparation_order_table: serviceToReopen.order_table,
      items: (serviceToReopen.items ?? []).map((item, index) => {
        const quantity = Number(item.quantity || 1)
        const price = Number(item.unit_price || 0)
        return {
          id: Date.now() + index,
          name: item.name,
          price,
          quantity,
          total: toMoney(price * quantity),
          sent_to_preparation: true,
        }
      }),
      total: toMoney(
        (serviceToReopen.items ?? []).reduce(
          (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 1),
          0,
        ),
      ),
    }

    const nextViewMode =
      serviceToReopen.type === 'command'
        ? 'commands'
        : serviceToReopen.type === 'room'
          ? 'hospital'
          : 'salon'

    setViewMode(nextViewMode)
    const updateList = (current: TableItem[]) => {
      const exists = current.some((item) => item.id === reopenedItem.id)
      if (exists) {
        return current.map((item) => (item.id === reopenedItem.id ? reopenedItem : item))
      }
      return [...current, reopenedItem]
    }

    if (serviceToReopen.type === 'command') setCommands(updateList)
    if (serviceToReopen.type === 'table') setTables(updateList)
    if (serviceToReopen.type === 'room') setRooms(updateList)

    setActiveItem(reopenedItem)
    setPaymentMethod('pix')
    setPayLaterDueDate('')
    setSelectedAppCustomerId('')
    setFiscalCpf('')
    setOrderMessage(
      `${getServiceLabel(reopenedItem)} reaberto. Os itens anteriores ja estao marcados como enviados; adicione novos produtos para enviar o acrescimo.`,
    )
    navigate(serviceToReopen.type === 'command' ? '/comandas' : '/mesas', {
      replace: true,
      state: null,
    })
  }, [location.state, navigate])

  const persistServiceItem = (item: TableItem) => {
    if (item.type === 'table') {
      setTables((current) => current.map((table) => (table.id === item.id ? item : table)))
      return
    }

    if (item.type === 'room') {
      setRooms((current) => current.map((room) => (room.id === item.id ? item : room)))
      return
    }

    setCommands((current) =>
      current.map((command) => (command.id === item.id ? item : command)),
    )
  }

  const getMatchingAppCustomerId = (item: TableItem) => {
    const phone = item.customer_phone.replace(/\D/g, '')
    const name = item.customer_name.trim().toLowerCase()
    const match = appCustomers.find((customer) => {
      const customerPhone = String(customer.phone || '').replace(/\D/g, '')
      return (phone && customerPhone === phone) || (name && customer.name.trim().toLowerCase() === name)
    })

    return match ? String(match.id) : ''
  }

  const selectAppCustomerForActiveItem = (customerId: string) => {
    setSelectedAppCustomerId(customerId)
    if (!activeItem) return

    const customer = appCustomers.find((appCustomer) => String(appCustomer.id) === customerId)
    if (!customer) return

    const updatedItem = {
      ...activeItem,
      customer_name: customer.name,
      customer_phone: customer.phone,
    }

    setPaymentMethod('cliente_app')
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)
  }

  const openItem = (item: TableItem) => {
    const updatedItem = { ...item }
    if (updatedItem.status === 'Livre') {
      updatedItem.status = 'Ocupada'
    }
    setPaymentMethod('pix')
    setPayLaterDueDate('')
    setSelectedAppCustomerId(getMatchingAppCustomerId(updatedItem))
    setFiscalCpf('')
    setOrderMessage('')
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)
  }

  const closeItem = () => {
    setActiveItem(null)
  }

  const addProductToTable = (product: Product) => {
    if (!activeItem) return

    const newItem: OrderItem = {
      id: Date.now(),
      name: product.name,
      price: product.unit_price,
      quantity: 1,
      total: product.unit_price,
    }

    const updatedItem = {
      ...activeItem,
      items: [...activeItem.items, newItem],
    }

    updatedItem.total = toMoney(updatedItem.items.reduce((sum, i) => sum + i.total, 0))
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)
  }

  const sendToPreparation = async () => {
    if (!activeItem || activeItem.items.length === 0) return
    const pendingItems = activeItem.items.filter((item) => !item.sent_to_preparation)
    if (pendingItems.length === 0) {
      setOrderMessage('Todos os itens ja foram enviados. Adicione mais produtos para enviar um novo acrescimo.')
      return
    }
    const pendingTotal = toMoney(pendingItems.reduce((sum, item) => sum + item.total, 0))

    const allItemsPayload = activeItem.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
    }))
    const totalAmount = toMoney(activeItem.items.reduce((sum, item) => sum + item.total, 0))

    let error: { message: string } | null = null
    let preparationOrderId = activeItem.preparation_order_id
    let preparationOrderIds = activeItem.preparation_order_ids ?? []
    let preparationOrderTable = activeItem.preparation_order_table

    if (preparationOrderTable === 'room_orders' && preparationOrderId) {
      const updateResult = await supabase
        .from('room_orders')
        .update({
          patient_name: activeItem.customer_name,
          phone: activeItem.customer_phone,
          items: allItemsPayload,
          total_amount: totalAmount,
          customer_message: 'Pedido atualizado pelo PDV.',
        })
        .eq('id', preparationOrderId)

      error = updateResult.error
    } else {
      const sourceType = getServiceSource(activeItem.type)

      if (!preparationOrderId || preparationOrderTable !== 'service_orders') {
        const existingResult = await supabase
          .from('service_orders')
          .select('id, status, created_at')
          .eq('source_type', sourceType)
          .eq('service_number', activeItem.number)
          .order('created_at', { ascending: false })

        if (!existingResult.error) {
          const openOrders = (existingResult.data ?? []).filter(
            (order) => !['entregue', 'cancelado'].includes(order.status),
          )
          preparationOrderId = openOrders[0]?.id
          preparationOrderIds = openOrders.map((order) => order.id)
        }
      }

      if (preparationOrderId) {
        const updateResult = await supabase
          .from('service_orders')
          .update({
            source_type: sourceType,
            service_number: activeItem.number,
            customer_name: activeItem.customer_name,
            customer_phone: activeItem.customer_phone,
            items: allItemsPayload,
            total_amount: totalAmount,
            customer_message: 'Pedido atualizado pelo PDV.',
          })
          .eq('id', preparationOrderId)

        error = updateResult.error

        const duplicateIds = preparationOrderIds.filter((id) => id !== preparationOrderId)
        if (!error && duplicateIds.length > 0) {
          await supabase
            .from('service_orders')
            .update({
              status: 'cancelado',
              customer_message: 'Pedido unificado na comanda principal.',
            })
            .in('id', duplicateIds)
        }
      } else {
        const insertResult = await supabase
          .from('service_orders')
          .insert([
            {
              source_type: sourceType,
              service_number: activeItem.number,
              customer_name: activeItem.customer_name,
              customer_phone: activeItem.customer_phone,
              items: pendingItems.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
              })),
              total_amount: pendingTotal,
              status: 'recebido',
              customer_message: 'Pedido recebido pelo PDV.',
            },
          ])
          .select('id')
          .single()

        error = insertResult.error
        preparationOrderId = insertResult.data?.id
        preparationOrderIds = preparationOrderId ? [preparationOrderId] : []
      }

      preparationOrderTable = 'service_orders'
    }

    if (error) {
      console.error('Erro ao enviar pedido:', error)
      setOrderMessage(
        'Nao foi possivel enviar para Pedidos feitos. Execute o SQL atualizado.',
      )
      return
    }

    const updatedItem = {
      ...activeItem,
      preparation_order_id: preparationOrderId,
      preparation_order_ids: preparationOrderIds.length > 0 ? preparationOrderIds : preparationOrderId ? [preparationOrderId] : [],
      preparation_order_table: preparationOrderTable,
      items: activeItem.items.map((item) => ({
        ...item,
        sent_to_preparation: true,
      })),
    }
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)
    setOrderMessage('Itens enviados para a aba Pedidos feitos. Se o cliente pedir mais, adicione novos produtos e envie o acrescimo.')
  }

  const syncPreparationOrder = async (item: TableItem) => {
    if (!item.preparation_order_id || !item.preparation_order_table) return

    const itemsPayload = item.items.map((orderItem) => ({
      name: orderItem.name,
      quantity: orderItem.quantity,
      unit_price: orderItem.price,
    }))
    const hasItems = itemsPayload.length > 0

    if (item.preparation_order_table === 'room_orders') {
      const roomUpdate: {
        patient_name: string
        phone: string
        items: typeof itemsPayload
        total_amount: number
        customer_message: string
        status?: string
      } = {
        patient_name: item.customer_name,
        phone: item.customer_phone,
        items: itemsPayload,
        total_amount: item.total,
        customer_message: hasItems
          ? 'Pedido atualizado pelo PDV.'
          : 'Pedido cancelado pelo PDV.',
      }

      if (!hasItems) roomUpdate.status = 'cancelado'

      await supabase
        .from('room_orders')
        .update(roomUpdate)
        .eq('id', item.preparation_order_id)
      return
    }

    const serviceUpdate: {
      customer_name: string
      customer_phone: string
      items: typeof itemsPayload
      total_amount: number
      customer_message: string
      status?: string
    } = {
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      items: itemsPayload,
      total_amount: item.total,
      customer_message: hasItems
        ? 'Pedido atualizado pelo PDV.'
        : 'Pedido cancelado pelo PDV.',
    }

    if (!hasItems) serviceUpdate.status = 'cancelado'

    await supabase
      .from('service_orders')
      .update(serviceUpdate)
      .eq('id', item.preparation_order_id)
  }

  const removeItem = async (itemId: number) => {
    if (!activeItem) return
    const removedItem = activeItem.items.find((item) => item.id === itemId)

    if (
      removedItem?.sent_to_preparation &&
      !window.confirm('Excluir este item que ja foi enviado para pedidos?')
    ) {
      return
    }

    const updatedItem = {
      ...activeItem,
      items: activeItem.items.filter((item) => item.id !== itemId),
    }

    updatedItem.total = toMoney(updatedItem.items.reduce((sum, i) => sum + i.total, 0))
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)

    if (removedItem?.sent_to_preparation) {
      await syncPreparationOrder(updatedItem)
      setOrderMessage(
        updatedItem.items.length > 0
          ? 'Item excluido e pedido atualizado.'
          : 'Item excluido e pedido cancelado.',
      )
    }
  }

  const payCommand = () => {
    if (!activeItem) return

    if (paymentMethod === 'pagar_depois' && !canPayLater) {
      alert('Preencha nome e telefone para usar pagar depois.')
      return
    }

    const selectedAppCustomer = appCustomers.find(
      (customer) => String(customer.id) === selectedAppCustomerId,
    )

    if (paymentMethod === 'cliente_app') {
      if (!selectedAppCustomer) {
        alert('Escolha o cliente do app para lancar a compra.')
        return
      }

      const creditLimit = Number(selectedAppCustomer.credit_limit || 0)
      const pendingTotal = Number(selectedAppCustomer.pending_total || 0)
      const availableCredit = Math.max(creditLimit - pendingTotal, 0)

      if (creditLimit > 0 && activeItem.total > availableCredit) {
        alert('Compra acima do saldo disponivel deste cliente app.')
        return
      }
    }

    const receiptCustomerName =
      paymentMethod === 'cliente_app' && selectedAppCustomer
        ? selectedAppCustomer.name
        : activeItem.customer_name
    const receiptCustomerPhone =
      paymentMethod === 'cliente_app' && selectedAppCustomer
        ? selectedAppCustomer.phone
        : activeItem.customer_phone

    const receiptBase: Omit<ReceiptData, 'fiscal_qr_text'> = {
      type: activeItem.type,
      number: activeItem.number,
      items: [...activeItem.items],
      total: activeItem.total,
      customer_name: receiptCustomerName,
      customer_phone: receiptCustomerPhone,
      date: new Date().toLocaleString('pt-BR'),
      payment_method: paymentMethod,
      app_customer_id: selectedAppCustomer?.id,
      app_customer_position: selectedAppCustomer?.position,
      fiscal_cpf: fiscalCpf,
    }
    const receipt: ReceiptData = {
      ...receiptBase,
      fiscal_qr_text: createFiscalQrText(receiptBase),
    }

    setReceiptData(receipt)
    setIsReprint(false)
    setShowReceipt(true)
  }

  const refreshPrinterSettings = () => {
    setPrinterSettings(readReceiptPrinterSettings())
  }

  const printReceipt = () => {
    refreshPrinterSettings()
    document.body.classList.add('printing-receipt')
    const clearPrintMode = () => {
      document.body.classList.remove('printing-receipt')
      window.removeEventListener('afterprint', clearPrintMode)
      window.removeEventListener('focus', clearPrintMode)
    }

    window.addEventListener('afterprint', clearPrintMode)
    window.addEventListener('focus', clearPrintMode)
    window.setTimeout(() => {
      window.print()
      window.setTimeout(clearPrintMode, 2500)
    }, 50)
  }

  const closeReceiptPreview = () => {
    document.body.classList.remove('printing-receipt')
    setIsReprint(false)
    setShowReceipt(false)
  }

  const reprintLastReceipt = () => {
    if (!lastReceipt) return
    refreshPrinterSettings()
    setReceiptData(lastReceipt)
    setIsReprint(true)
    setShowReceipt(true)
  }

  const finalizePayment = async () => {
    if (!receiptData || !activeItem) return

    const salePayload = {
      table_number: receiptData.number,
      total_amount: receiptData.total,
      cashier_name: currentUser?.username || 'Desconhecido',
      customer_name: receiptData.customer_name,
      customer_phone: receiptData.customer_phone,
      fiscal_cpf: receiptData.fiscal_cpf || null,
      items: receiptData.items,
      payment_method: receiptData.payment_method,
    }

    try {
      const { error } = await supabase.from('sales').insert([salePayload])

      if (error) throw error

      localStorage.setItem(LAST_RECEIPT_KEY, JSON.stringify(receiptData))
      setLastReceipt(receiptData)

      if (receiptData.fiscal_cpf && isCompleteCpf(receiptData.fiscal_cpf)) {
        queueFiscalPayload(
          createFiscalPayload({
            customerCpf: receiptData.fiscal_cpf,
            totalAmount: receiptData.total,
            paymentMethod: receiptData.payment_method,
            items: receiptData.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit_price: item.price,
              total: item.total,
            })),
          }),
        )
      }

      if (
        receiptData.payment_method === 'pagar_depois' ||
        receiptData.payment_method === 'cliente_app'
      ) {
        const itemsDetail = receiptData.items
          .map((item) => `${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}`)
          .join('; ')
        const pendingPayload = {
          customer_name: receiptData.customer_name,
          phone: receiptData.customer_phone,
          position: receiptData.app_customer_position || getServiceLabel(activeItem),
          description:
            receiptData.payment_method === 'cliente_app'
              ? `Compra lancada pelo caixa em ${getServiceLabel(activeItem)}`
              : `Venda registrada em ${receiptData.date}`,
          items_detail: itemsDetail,
          total_amount: receiptData.total,
          purchase_date: new Date().toISOString().slice(0, 10),
          due_date:
            receiptData.payment_method === 'cliente_app'
              ? getFifthBusinessDay()
              : payLaterDueDate || new Date().toISOString().slice(0, 10),
          status: 'pendente',
        }

        const { error: pendingError } = await supabase
          .from('pending_payments')
          .insert([pendingPayload])

        if (pendingError) {
          const offlinePending = queueOfflineRecord(
            'pending_payments',
            pendingPayload,
            pendingError.message || 'Falha ao registrar pagar depois.',
          )
          logAppError({
            source: 'TableManager',
            action: 'finalizePayment.pendingPaymentQueue',
            error: pendingError,
            details: { offlineId: offlinePending.id },
          })
        }
      }

      if (activeItem.preparation_order_id && activeItem.preparation_order_table) {
        const targetIds =
          activeItem.preparation_order_ids && activeItem.preparation_order_ids.length > 0
            ? activeItem.preparation_order_ids
            : [activeItem.preparation_order_id]

        await supabase
          .from(activeItem.preparation_order_table)
          .update({
            status: 'entregue',
            customer_message: 'Atendimento pago e finalizado no PDV.',
          })
          .in('id', targetIds)
      }

      // Atualizar o estado do atendimento fechado.
      if (activeItem.type === 'table') {
        const updatedTables = tables.map((t) => (t.id === activeItem.id ? getItemReset(t) : t))
        setTables(updatedTables)
      } else if (activeItem.type === 'room') {
        const updatedRooms = rooms.map((r) => (r.id === activeItem.id ? getItemReset(r) : r))
        setRooms(updatedRooms)
      } else {
        const updatedCommands = commands.map((command) =>
          command.id === activeItem.id ? getItemReset(command) : command,
        )
        setCommands(updatedCommands)
      }

      setActiveItem(null)
      setShowReceipt(false)
      setIsReprint(false)
      setSelectedAppCustomerId('')
      fetchAppCustomers()
      markBackupNeededAfterClosing('Venda registrada no PDV apos as 20:00')
      void openCashDrawer(receiptData.payment_method)
      alert('Venda registrada com sucesso no cofre!')
    } catch (err) {
      const offlineSale = queueOfflineSale(
        salePayload,
        (err as Error).message || 'Falha de conexao ou Supabase indisponivel.',
      )
      alert(
        `Venda salva em modo offline para sincronizar depois. Codigo local: ${offlineSale.id}`,
      )
    }
  }

  const updateActiveItemField = (field: string, value: string) => {
    if (!activeItem) return
    const updatedItem = { ...activeItem, [field]: value }
    setActiveItem(updatedItem)
    persistServiceItem(updatedItem)
  }

  const canPayLater = Boolean(
    activeItem?.customer_name.trim() && activeItem?.customer_phone.trim(),
  )
  const pendingPreparationCount =
    activeItem?.items.filter((item) => !item.sent_to_preparation).length ?? 0
  const selectedAppCustomer = appCustomers.find(
    (customer) => String(customer.id) === selectedAppCustomerId,
  )
  const selectedAppCustomerAvailable = selectedAppCustomer
    ? Math.max(
        Number(selectedAppCustomer.credit_limit || 0) -
          Number(selectedAppCustomer.pending_total || 0),
        0,
      )
    : 0

  const roomFloors = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => Math.floor(room.number / 100))))
  }, [rooms])

  const currentList = useMemo(() => {
    if (viewMode === 'salon') return tables
    if (viewMode === 'commands') return commands

    return rooms.filter((room) => {
      const matchesFloor =
        selectedFloor === 'todos' ||
        Math.floor(room.number / 100).toString() === selectedFloor
      const matchesSearch =
        !roomSearch.trim() || room.number.toString().includes(roomSearch.trim())

      return matchesFloor && matchesSearch
    })
  }, [commands, rooms, roomSearch, selectedFloor, tables, viewMode])

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    const byTab = availableProducts.filter((product) => {
      if (productTab === 'todos') return true
      const category = String(product.category || '').toLowerCase()
      const isDrink = category.includes('bebida')
      const isGift = category.includes('presente')
      if (productTab === 'bebidas') return isDrink
      if (productTab === 'presentes') return isGift
      return !isDrink && !isGift
    })
    if (!search) return byTab

    return byTab.filter((product) =>
      [product.name, product.description, product.category, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [availableProducts, productSearch, productTab])

  const openNewCommand = () => {
    const nextNumber = Math.max(0, ...commands.map((command) => command.number)) + 1
    const newCommand = {
      ...createServiceItem(nextNumber, 'command'),
      status: 'Ocupada' as const,
    }
    setCommands((current) => [...current, newCommand])
    setActiveItem(newCommand)
  }

  return (
    <div className="pdv-container">
      {!activeItem && (
        <>
          <div className="mode-selector no-print">
            <button
              className={`mode-btn ${viewMode === 'salon' ? 'active' : ''}`}
              onClick={() => setViewMode('salon')}
            >
              Salao (Mesas)
            </button>
            <button
              className={`mode-btn ${viewMode === 'hospital' ? 'active' : ''}`}
              onClick={() => setViewMode('hospital')}
            >
              Hospital (Quartos)
            </button>
            <button
              className={`mode-btn ${viewMode === 'commands' ? 'active' : ''}`}
              onClick={() => setViewMode('commands')}
            >
              Comandas
            </button>
            <button className="mode-btn" onClick={() => navigate('/pedidos')}>
              Ultimos pedidos feitos
            </button>
          </div>

          <div className="grid-view no-print">
            {viewMode === 'hospital' && (
              <div className="room-filters">
                <select
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(e.target.value)}
                >
                  <option value="todos">Todos os andares</option>
                  {roomFloors.map((floor) => (
                    <option key={floor} value={floor}>
                      Andar {floor}
                    </option>
                  ))}
                </select>
                <input
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Buscar quarto"
                />
              </div>
            )}
            {viewMode === 'commands' && (
              <div className="commands-toolbar">
                <button onClick={openNewCommand} className="btn-new-command">
                  Abrir nova comanda
                </button>
                <span>Pedidos por telefone ou direto no caixa, identificados pelo nome.</span>
              </div>
            )}
            <div className="cards-grid">
              {currentList.map((item) => (
                <div
                  key={item.id}
                  className={`item-card ${item.status === 'Livre' ? 'free' : 'occupied'}`}
                  onClick={() => openItem(item)}
                >
                  <h3>{getServiceLabel(item)}</h3>
                  <p className="status">{item.status}</p>
                  {item.customer_name && (
                    <p className="customer-info">{item.customer_name}</p>
                  )}
                  {item.status === 'Ocupada' && (
                    <p className="total-tag">R$ {item.total.toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeItem && (
        <div className="command-view no-print">
          <header className="command-header">
            <button onClick={closeItem} className="btn-back">
              Voltar
            </button>
            <h2>{getServiceLabel(activeItem)}</h2>
            <div className="total-badge">R$ {activeItem.total.toFixed(2)}</div>
          </header>

          <div className="split-layout">
            <div className="products-showcase glass-panel">
              <div className="products-showcase-header">
                <h3>Produtos</h3>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Pesquisar produto"
                />
              </div>
              <div className="product-tabs" aria-label="Filtro de produtos">
                <button
                  className={productTab === 'todos' ? 'active' : ''}
                  onClick={() => setProductTab('todos')}
                >
                  Todos
                </button>
                <button
                  className={productTab === 'bebidas' ? 'active' : ''}
                  onClick={() => setProductTab('bebidas')}
                >
                  Bebidas
                </button>
                <button
                  className={productTab === 'comidas' ? 'active' : ''}
                  onClick={() => setProductTab('comidas')}
                >
                  Comidas
                </button>
                <button
                  className={productTab === 'presentes' ? 'active' : ''}
                  onClick={() => setProductTab('presentes')}
                >
                  Presentes
                </button>
              </div>
              <div className="visual-menu">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`product-item-card ${
                      Number(product.low_stock_threshold || 0) > 0 &&
                      Number(product.stock_quantity || 0) <=
                        Number(product.low_stock_threshold || 0)
                        ? 'low-stock'
                        : ''
                    }`}
                    onClick={() => addProductToTable(product)}
                  >
                    <div className="img-wrapper">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className={`no-img-placeholder ${product.category === 'bebida' ? 'bebida' : 'comida'}`}>
                          <span>{product.category === 'bebida' ? 'Bebida' : 'Cafe'}</span>
                        </div>
                      )}
                    </div>
                    <div className="product-info-mini">
                      <span className="p-name">{product.name}</span>
                      <span className="p-price">
                        R$ {product.unit_price.toFixed(2)}
                      </span>
                      {Number(product.low_stock_threshold || 0) > 0 &&
                        Number(product.stock_quantity || 0) <=
                          Number(product.low_stock_threshold || 0) && (
                          <span className="p-stock-warning">Estoque baixo</span>
                        )}
                    </div>
                  </div>
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <p className="product-search-empty">Nenhum produto encontrado.</p>
              )}
            </div>

            <div className="active-command-panel">
              {activeItem.type === 'room' && (
                <div className="glass-panel hospital-fields">
                  <input
                    type="text"
                    value={activeItem.customer_name}
                    onChange={(e) =>
                      updateActiveItemField('customer_name', e.target.value)
                    }
                    placeholder="👤 Nome do Paciente/Acompanhante"
                  />
                  <input
                    type="text"
                    value={activeItem.customer_phone}
                    onChange={(e) =>
                      updateActiveItemField('customer_phone', e.target.value)
                    }
                    placeholder="📞 Ramal ou Telefone"
                  />
                </div>
              )}

              {activeItem.type !== 'room' && (
                <div className="glass-panel hospital-fields">
                  {activeItem.type === 'command' && (
                    <div className="app-customer-command-picker">
                      <label>Cliente app na comanda</label>
                      <select
                        value={selectedAppCustomerId}
                        onChange={(e) => selectAppCustomerForActiveItem(e.target.value)}
                      >
                        <option value="">Comanda pelo nome da pessoa</option>
                        {appCustomers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} - {customer.phone}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={fetchAppCustomers}>
                        Atualizar clientes app
                      </button>
                    </div>
                  )}
                  <input
                    type="text"
                    value={activeItem.customer_name}
                    onChange={(e) =>
                      updateActiveItemField('customer_name', e.target.value)
                    }
                    placeholder={
                      activeItem.type === 'command'
                        ? 'Nome da pessoa na comanda'
                        : 'Nome do cliente'
                    }
                  />
                  <input
                    type="text"
                    value={activeItem.customer_phone}
                    onChange={(e) =>
                      updateActiveItemField('customer_phone', e.target.value)
                    }
                    placeholder={
                      activeItem.type === 'command' ? 'Telefone do pedido' : 'Telefone'
                    }
                  />
                </div>
              )}

              <div className="glass-panel items-list-panel">
                <h3>Itens na Comanda</h3>
                {orderMessage && <p className="order-message">{orderMessage}</p>}
                {activeItem.items.length === 0 ? (
                  <p className="empty-state">
                    Toque em um produto ao lado para adicionar.
                  </p>
                ) : (
                  <div className="mobile-items-list">
                    {activeItem.items.map((item) => (
                      <div key={item.id} className="mobile-item">
                        <div className="item-details">
                          <span className="item-name">{item.name}</span>
                          <span className="item-price">
                            R$ {item.price.toFixed(2)}
                          </span>
                          <span
                            className={`item-prep-status ${
                              item.sent_to_preparation ? 'sent' : 'pending'
                            }`}
                          >
                            {item.sent_to_preparation ? 'Enviado' : 'Novo item'}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="btn-remove-item"
                        >
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeItem.items.length > 0 && (
                  <>
                    <button onClick={sendToPreparation} className="btn-send-order">
                      {pendingPreparationCount > 0
                        ? `Enviar ${pendingPreparationCount} novo(s) item(ns)`
                        : 'Adicionar mais itens'}
                    </button>
                    {pendingPreparationCount === 0 && (
                      <p className="preparation-hint">
                        Todos os itens desta comanda ja foram enviados. Toque em um produto
                        para acrescentar e enviar de novo.
                      </p>
                    )}
                    {currentUser?.role !== 'garcom' ? (
                      <>
                        <div className="payment-methods">
                          <label>Forma de pagamento</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => {
                              const nextPaymentMethod = e.target.value as PaymentMethod
                              setPaymentMethod(nextPaymentMethod)
                              if (nextPaymentMethod === 'cliente_app') {
                                fetchAppCustomers()
                                const matchingCustomerId = getMatchingAppCustomerId(activeItem)
                                if (matchingCustomerId) setSelectedAppCustomerId(matchingCustomerId)
                              }
                            }}
                          >
                            <option value="pix">Pix</option>
                            <option value="credito">Cartao de credito</option>
                            <option value="debito">Cartao de debito</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cliente_app">Cliente app</option>
                            {canPayLater && (
                              <option value="pagar_depois">Pagar depois</option>
                            )}
                          </select>
                          {!canPayLater && (
                            <small>Preencha nome e telefone para liberar pagar depois.</small>
                          )}
                        </div>
                        {paymentMethod === 'pagar_depois' && (
                          <div className="payment-methods">
                            <label>Data combinada para pagamento</label>
                            <input
                              type="date"
                              value={payLaterDueDate}
                              onChange={(e) => setPayLaterDueDate(e.target.value)}
                            />
                            <small>Pagamento somente por Pix ou dinheiro.</small>
                          </div>
                        )}
                        {paymentMethod === 'cliente_app' && (
                          <div className="payment-methods app-customer-charge">
                            <label>Cliente do app</label>
                            <select
                              value={selectedAppCustomerId}
                              onChange={(e) => selectAppCustomerForActiveItem(e.target.value)}
                            >
                              <option value="">Escolha o cliente</option>
                              {appCustomers.map((customer) => {
                                const available = Math.max(
                                  Number(customer.credit_limit || 0) -
                                    Number(customer.pending_total || 0),
                                  0,
                                )
                                const limitLabel =
                                  Number(customer.credit_limit || 0) > 0
                                    ? ` - saldo ${available.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}`
                                    : ' - sem limite definido'

                                return (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name} - {customer.phone}{limitLabel}
                                  </option>
                                )
                              })}
                            </select>
                            <button
                              type="button"
                              className="btn-refresh-app-customers"
                              onClick={fetchAppCustomers}
                            >
                              Atualizar clientes
                            </button>
                            {selectedAppCustomer && (
                              <small>
                                Sera lancado no app de {selectedAppCustomer.name}. Saldo apos esta
                                compra:{' '}
                                {Math.max(
                                  selectedAppCustomerAvailable - activeItem.total,
                                  0,
                                ).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </small>
                            )}
                          </div>
                        )}
                        <div className="payment-methods">
                          <label>CPF para Nota Fiscal Paulista</label>
                          <input
                            value={fiscalCpf}
                            onChange={(e) => setFiscalCpf(formatCpf(e.target.value))}
                            placeholder="123.456.789-10"
                            inputMode="numeric"
                            maxLength={14}
                          />
                          <small>Opcional. Use quando o cliente pedir CPF na nota.</small>
                        </div>
                        <button onClick={payCommand} className="btn-pay">
                          Encerrar e Pagar
                        </button>
                      </>
                    ) : (
                      <p className="garcom-aviso">
                        Pedido pode ser enviado para preparo. Pagamento fica com o caixa.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <>
          <div className="receipt-modal-overlay no-print">
            <div className="receipt-modal-content">
              <h2>Pagamento Pronto!</h2>
              <div className="modal-actions">
                <button onClick={printReceipt} className="btn-print">
                  🖨️ Imprimir Recibo
                </button>
                {!isReprint && (
                  <button onClick={closeReceiptPreview} className="btn-close-receipt">
                    Acrescentar produtos
                  </button>
                )}
                <button onClick={closeReceiptPreview} className="btn-close-receipt">
                  Fechar recibo
                </button>
                {!isReprint && (
                  <button onClick={finalizePayment} className="btn-close-receipt">
                    Confirmar no Sistema
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className={`printable-receipt ${
              printerSettings.compactMode ? 'compact' : ''
            } receipt-${printerSettings.paperWidth}`}
            style={
              {
                '--receipt-width': printerSettings.paperWidth,
                '--receipt-height': `${printerSettings.paperHeightMm}mm`,
                '--receipt-font-size': `${printerSettings.fontSizePt}pt`,
                '--receipt-line-height': printerSettings.lineHeight,
                '--receipt-logo-size': `${printerSettings.logoSizeMm}mm`,
                '--receipt-feed-space': `${printerSettings.bottomFeedMm}mm`,
              } as CSSProperties
            }
          >
            <div className="receipt-header">
              {printerSettings.logoEnabled && printerSettings.logoSizeMm > 0 && (
                <img className="receipt-logo" src="/logo.jpeg" alt="Dr. Cafe" />
              )}
              <h2>DR. CAFE</h2>
              <p>
                <strong>CUPOM NAO FISCAL</strong>
              </p>
              <hr />
            </div>
            <div className="receipt-section">
              <h3>Atendimento</h3>
              {receiptData && <p>{getServiceLabel(receiptData)}</p>}
              {receiptData?.customer_name && <p>Cliente: {receiptData.customer_name}</p>}
              {receiptData?.customer_phone && <p>Telefone: {receiptData.customer_phone}</p>}
              {receiptData?.fiscal_cpf && <p>CPF NFP: {receiptData.fiscal_cpf}</p>}
              <p>Data: {receiptData?.date}</p>
            </div>
            <table className="receipt-table">
              <tbody>
                {receiptData?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.quantity}</td>
                    <td>{item.name}</td>
                    <td>R$ {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-footer">
              <hr />
              <p>Pagamento: {receiptData?.payment_method}</p>
              {receiptData?.payment_method === 'pagar_depois' && (
                <p>Pagamento combinado somente por Pix ou dinheiro.</p>
              )}
              <h3>TOTAL: R$ {receiptData?.total.toFixed(2)}</h3>
            </div>
            {receiptData?.fiscal_cpf && (
              <div className="receipt-fiscal">
                <h3>Nota Fiscal Paulista</h3>
                <div className="receipt-fiscal__qr" aria-label="QR Code da Nota Fiscal Paulista">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p>CPF: {receiptData.fiscal_cpf}</p>
                <p>QR Code fiscal pendente de emissao pela SEFAZ.</p>
                <small>{receiptData.fiscal_qr_text}</small>
              </div>
            )}
            <div className="receipt-feed-space" aria-hidden="true">
              <span>&nbsp;</span>
              <span>&nbsp;</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
