import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ADMIN_ROLES, hasRole, type CurrentUser } from '../lib/rolePermissions'
import { queueOfflineDelete, queueOfflineRecord, queueOfflineUpdate } from '../lib/offlineQueue'
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
interface PdvCustomer {
  id: number
  name: string
  phone: string
  position?: string | null
  notes?: string | null
  status: 'ativo' | 'bloqueado'
}

interface AppOrder {
  id: number
  items?: Array<{
    name?: string
    quantity?: number
    unit_price?: number
  }>
  total_amount: number
}

interface SaleRecord {
  id: number
  items?: Array<{
    name?: string
    quantity?: number
    unit_price?: number
    price?: number
    total?: number
  }>
  total_amount: number
}

const initialPdvCustomer = {
  name: '',
  phone: '',
  position: '',
  notes: '',
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

const formatLocalDate = (date: string) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') : '-'

const splitPendingItems = (itemsDetail?: string) =>
  (itemsDetail || '-')
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean)

const parseMoneyValue = (value?: string) =>
  String(value ?? '').includes(',')
    ? Number(String(value ?? '0').replace(/\./g, '').replace(',', '.') || 0)
    : Number(value || 0)

const getPendingItemAmount = (item: string, fallbackAmount: number) => {
  const match = item.match(/R\$\s*([\d.,]+)/i)
  const amount = parseMoneyValue(match?.[1])
  return amount > 0 ? amount : fallbackAmount
}

const normalizeText = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const parsePendingItem = (item: string) => {
  const match = item.match(/^(\d+(?:[.,]\d+)?)x\s+(.+?)(?:\s+-\s+R\$\s*([\d.,]+))?$/i)
  if (!match) {
    return { quantity: 1, name: item.trim(), total: 0 }
  }

  return {
    quantity: parseMoneyValue(match[1]) || 1,
    name: match[2].trim(),
    total: parseMoneyValue(match[3]),
  }
}

const isAppPendingPayment = (pending: PendingPayment) => {
  const description = normalizeText(pending.description)

  return description.includes('app') || description.includes('dr. cafe')
}

const getDayRange = (date: string) => {
  const startDate = `${date}T00:00:00`
  const endDate = new Date(`${date}T00:00:00`)
  endDate.setDate(endDate.getDate() + 1)

  return { startDate, endDate: endDate.toISOString() }
}

interface PendingPaymentsProps {
  currentUser?: CurrentUser | null
}

export default function PendingPayments({ currentUser }: PendingPaymentsProps) {
  const [pendingList, setPendingList] = useState<PendingPayment[]>([])
  const [pdvCustomers, setPdvCustomers] = useState<PdvCustomer[]>([])
  const [newPdvCustomer, setNewPdvCustomer] = useState(initialPdvCustomer)
  const [editingPdvCustomerId, setEditingPdvCustomerId] = useState<number | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [newPending, setNewPending] = useState<NewPending>(initialPending)
  const [pendingItem, setPendingItem] = useState('')
  const [pendingItems, setPendingItems] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedPendingGroups, setExpandedPendingGroups] = useState<Record<string, boolean>>({})
  const isAdmin = Boolean(currentUser && hasRole(currentUser, ADMIN_ROLES))

  const filteredPdvCustomers = useMemo(() => {
    const search = normalizeText(customerSearch)
    const customers = [...pdvCustomers].sort((first, second) =>
      first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }),
    )

    if (!search) return customers

    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.position, customer.notes]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(search)),
    )
  }, [customerSearch, pdvCustomers])

  const totalPending = useMemo(
    () =>
      pendingList
        .filter((payment) => payment.status === 'pendente')
        .reduce((sum, payment) => sum + Number(payment.total_amount), 0),
    [pendingList],
  )

  const filteredPendingList = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    if (!search) return pendingList

    return pendingList.filter((payment) =>
      [
        payment.customer_name,
        payment.phone,
        payment.position,
        payment.description,
        payment.items_detail,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [pendingList, searchTerm])

  const groupedPending = useMemo(() => {
    const groups = filteredPendingList
      .filter((payment) => payment.status === 'pendente')
      .reduce<Record<string, PendingPayment[]>>((grouped, payment) => {
        const key = `${payment.customer_name}__${payment.phone}`
        grouped[key] = [...(grouped[key] ?? []), payment]
        return grouped
      }, {})

    return Object.fromEntries(
      Object.entries(groups).sort(([, firstEntries], [, secondEntries]) =>
        firstEntries[0].customer_name.localeCompare(secondEntries[0].customer_name, 'pt-BR', {
          sensitivity: 'base',
        }),
      ),
    )
  }, [filteredPendingList])

  const fetchPending = async () => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select('*')
      .order('customer_name', { ascending: true })
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar pendencias:', error)
      setMessage('Execute o SQL atualizado para criar pending_payments.')
    } else {
      setPendingList(data ?? [])
    }
  }

  const fetchPdvCustomers = async () => {
    const { data, error } = await supabase
      .from('pdv_customers')
      .select('id, name, phone, position, notes, status')
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar clientes PDV:', error)
      setMessage('Execute o SQL pdv-customers.sql no Supabase para liberar cadastro de clientes PDV.')
      return
    }

    setPdvCustomers((data ?? []) as PdvCustomer[])
  }

  useEffect(() => {
    fetchPending()
    fetchPdvCustomers()
  }, [])

  const selectPdvCustomerForPending = (customer: PdvCustomer) => {
    setNewPending((current) => ({
      ...current,
      customer_name: customer.name,
      phone: customer.phone,
      position: customer.position || '',
    }))
    setMessage(`Cliente ${customer.name} selecionado para nova pendencia.`)
  }

  const savePdvCustomer = async () => {
    const name = newPdvCustomer.name.trim()
    const phone = newPdvCustomer.phone.trim()

    if (!name || !phone) {
      setMessage('Informe nome e telefone para cadastrar cliente PDV.')
      return
    }

    const payload = {
      name,
      phone,
      position: newPdvCustomer.position.trim(),
      notes: newPdvCustomer.notes.trim(),
      status: 'ativo',
    }

    const updatePayload = {
      name: payload.name,
      phone: payload.phone,
      position: payload.position,
      notes: payload.notes,
    }

    const { error } = editingPdvCustomerId
      ? await supabase.from('pdv_customers').update(updatePayload).eq('id', editingPdvCustomerId)
      : await supabase.from('pdv_customers').upsert([payload], { onConflict: 'phone' })

    if (error) {
      const reason = error.message || 'Falha de conexao ou Supabase indisponivel.'

      if (editingPdvCustomerId) {
        queueOfflineUpdate('pdv_customers', [editingPdvCustomerId], updatePayload, reason)
        setPdvCustomers((current) =>
          current.map((customer) =>
            customer.id === editingPdvCustomerId ? { ...customer, ...updatePayload } : customer,
          ),
        )
      } else {
        queueOfflineRecord('pdv_customers', payload, reason)
      }

      setNewPdvCustomer(initialPdvCustomer)
      setEditingPdvCustomerId(null)
      setMessage(
        `Sem conexao: cliente PDV ${name} salvo neste computador e sera sincronizado quando a internet voltar.`,
      )
      return
    }

    setNewPdvCustomer(initialPdvCustomer)
    setEditingPdvCustomerId(null)
    setMessage(`Cliente PDV ${name} ${editingPdvCustomerId ? 'atualizado' : 'salvo'}.`)
    fetchPdvCustomers()
  }

  const editPdvCustomer = (customer: PdvCustomer) => {
    setEditingPdvCustomerId(customer.id)
    setNewPdvCustomer({
      name: customer.name,
      phone: customer.phone,
      position: customer.position || '',
      notes: customer.notes || '',
    })
    setMessage(`Editando cliente PDV ${customer.name}.`)
  }

  const cancelPdvCustomerEdit = () => {
    setEditingPdvCustomerId(null)
    setNewPdvCustomer(initialPdvCustomer)
    setMessage('Edicao cancelada.')
  }

  const updatePdvCustomerStatus = async (customer: PdvCustomer) => {
    const nextStatus = customer.status === 'ativo' ? 'bloqueado' : 'ativo'
    const { error } = await supabase
      .from('pdv_customers')
      .update({ status: nextStatus })
      .eq('id', customer.id)

    if (error) {
      queueOfflineUpdate(
        'pdv_customers',
        [customer.id],
        { status: nextStatus },
        error.message || 'Falha de conexao ou Supabase indisponivel.',
      )
      setPdvCustomers((current) =>
        current.map((item) => (item.id === customer.id ? { ...item, status: nextStatus } : item)),
      )
      setMessage(
        `Sem conexao: ${customer.name} ${nextStatus === 'ativo' ? 'ativado' : 'bloqueado'} neste computador, sera sincronizado quando a internet voltar.`,
      )
      return
    }

    setMessage(`${customer.name} ${nextStatus === 'ativo' ? 'ativado' : 'bloqueado'}.`)
    fetchPdvCustomers()
  }

  const deletePdvCustomer = async (customer: PdvCustomer) => {
    if (!isAdmin) return

    const confirmed = window.confirm(`Excluir o cadastro de ${customer.name}? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return

    const { error } = await supabase.from('pdv_customers').delete().eq('id', customer.id)

    if (error) {
      queueOfflineDelete(
        'pdv_customers',
        [customer.id],
        error.message || 'Falha de conexao ou Supabase indisponivel.',
      )
      setPdvCustomers((current) => current.filter((item) => item.id !== customer.id))

      if (editingPdvCustomerId === customer.id) {
        setEditingPdvCustomerId(null)
        setNewPdvCustomer(initialPdvCustomer)
      }

      setMessage(
        `Sem conexao: exclusao de ${customer.name} salva neste computador e sera sincronizada quando a internet voltar.`,
      )
      return
    }

    if (editingPdvCustomerId === customer.id) {
      setEditingPdvCustomerId(null)
      setNewPdvCustomer(initialPdvCustomer)
    }

    setMessage(`Cliente PDV ${customer.name} excluido.`)
    fetchPdvCustomers()
  }

  const handleAddPending = async () => {
    if (!newPending.customer_name.trim() || !newPending.phone.trim() || !newPending.due_date) {
      setMessage('Informe nome, telefone e data de pagamento.')
      return
    }

    const { error } = await supabase.from('pending_payments').insert([
      {
        ...newPending,
        items_detail: pendingItems.join('\n'),
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
    setPendingItem('')
    setPendingItems([])
    fetchPending()
  }

  const addPendingItem = () => {
    const item = pendingItem.trim()
    if (!item) return

    setPendingItems((items) => [...items, item])
    setPendingItem('')
  }

  const applySearch = () => {
    setSearchTerm(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const togglePendingGroup = (groupKey: string) => {
    setExpandedPendingGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }))
  }

  const markCustomerAsPaid = async (entries: PendingPayment[]) => {
    const pendingIds = entries
      .filter((entry) => entry.status === 'pendente')
      .map((entry) => entry.id)

    if (pendingIds.length === 0) return

    const first = entries[0]
    const total = entries.reduce((sum, entry) => sum + Number(entry.total_amount || 0), 0)
    const confirmed = window.confirm(
      `Marcar tudo de ${first.customer_name} como pago? Total: R$ ${total.toFixed(2)}`,
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('pending_payments')
      .update({ status: 'pago' })
      .in('id', pendingIds)

    if (error) {
      console.error('Erro ao quitar pendencias:', error)
      setMessage('Nao foi possivel quitar este cliente.')
      return
    }

    setMessage(`Pendencias de ${first.customer_name} quitadas.`)
    fetchPending()
  }

  const fetchMatchingOpenAppOrders = async (pending: PendingPayment) => {
    const { startDate, endDate } = getDayRange(pending.purchase_date)

    const { data, error } = await supabase
      .from('app_orders')
      .select('id, items, total_amount')
      .eq('customer_phone', pending.phone)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .not('status', 'in', '("entregue","cancelado")')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Pendencia alterada, mas nao foi possivel atualizar o app da cliente: ${error.message}`)
      return []
    }

    return (data ?? []) as AppOrder[]
  }

  const fetchMatchingClienteAppSales = async (pending: PendingPayment) => {
    const { startDate, endDate } = getDayRange(pending.purchase_date)

    const { data, error } = await supabase
      .from('sales')
      .select('id, items, total_amount')
      .eq('payment_method', 'cliente_app')
      .eq('customer_phone', pending.phone)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Pendencia alterada, mas nao foi possivel atualizar a venda: ${error.message}`)
      return []
    }

    return (data ?? []) as SaleRecord[]
  }

  const findSaleWithItem = (sales: SaleRecord[], itemName: string) => {
    const targetName = normalizeText(itemName)

    return sales.find((sale) =>
      (sale.items ?? []).some((item) => normalizeText(item.name) === targetName),
    )
  }

  const syncDeletedPendingToSales = async (pending: PendingPayment) => {
    const pendingItems = splitPendingItems(pending.items_detail).map(parsePendingItem)
    const sales = await fetchMatchingClienteAppSales(pending)

    const targetSale = sales.find((sale) => {
      const saleNames = (sale.items ?? []).map((item) => normalizeText(item.name))
      return pendingItems.some((item) => saleNames.includes(normalizeText(item.name)))
    })

    if (!targetSale) return

    const { error } = await supabase.from('sales').delete().eq('id', targetSale.id)

    if (error) {
      setMessage(`Pendencia removida, mas a venda ainda aparece no movimento: ${error.message}`)
    }
  }

  const syncDeletedPendingItemToSales = async (pending: PendingPayment, itemText: string) => {
    const deletedItem = parsePendingItem(itemText)
    const sales = await fetchMatchingClienteAppSales(pending)
    const targetSale = findSaleWithItem(sales, deletedItem.name)

    if (!targetSale) return

    let removed = false
    const nextItems = (targetSale.items ?? [])
      .map((item) => {
        if (removed || normalizeText(item.name) !== normalizeText(deletedItem.name)) {
          return item
        }

        removed = true
        const currentQuantity = Number(item.quantity || 1)
        const nextQuantity = currentQuantity - Number(deletedItem.quantity || 1)

        if (nextQuantity <= 0) return null

        const unitPrice = Number(item.unit_price ?? item.price ?? 0)
        return {
          ...item,
          quantity: nextQuantity,
          unit_price: unitPrice,
          total: Number((unitPrice * nextQuantity).toFixed(2)),
        }
      })
      .filter(Boolean) as NonNullable<SaleRecord['items']>

    if (nextItems.length === 0) {
      const { error } = await supabase.from('sales').delete().eq('id', targetSale.id)

      if (error) {
        setMessage(`Item removido da conta, mas a venda ainda aparece no movimento: ${error.message}`)
      }

      return
    }

    const nextTotal = nextItems.reduce((sum, item) => {
      const itemTotal =
        Number(item.total || 0) ||
        Number(item.unit_price ?? item.price ?? 0) * Number(item.quantity || 0)
      return sum + itemTotal
    }, 0)

    const { error } = await supabase
      .from('sales')
      .update({
        items: nextItems,
        total_amount: Number(nextTotal.toFixed(2)),
      })
      .eq('id', targetSale.id)

    if (error) {
      setMessage(`Item removido da conta, mas a venda nao foi recalculada: ${error.message}`)
    }
  }

  const syncDeletedPendingToAppOrder = async (pending: PendingPayment) => {
    if (!isAppPendingPayment(pending)) return

    const appOrders = await fetchMatchingOpenAppOrders(pending)
    const pendingItems = splitPendingItems(pending.items_detail).map(parsePendingItem)
    const pendingNames = pendingItems.map((item) => normalizeText(item.name))

    for (const order of appOrders) {
      const orderItems = order.items ?? []
      const hasSameItems = orderItems.some((item) =>
        pendingNames.includes(normalizeText(item.name)),
      )

      if (!hasSameItems) continue

      const { error } = await supabase
        .from('app_orders')
        .update({
          status: 'cancelado',
          customer_message: 'Pedido cancelado pelo cafe.',
        })
        .eq('id', order.id)

      if (error) {
        setMessage(`Pendencia removida, mas o pedido ainda aparece no app: ${error.message}`)
      }

      return
    }
  }

  const syncDeletedPendingItemToAppOrder = async (pending: PendingPayment, itemText: string) => {
    if (!isAppPendingPayment(pending)) return

    const deletedItem = parsePendingItem(itemText)
    const deletedName = normalizeText(deletedItem.name)
    const appOrders = await fetchMatchingOpenAppOrders(pending)

    for (const order of appOrders) {
      const orderItems = order.items ?? []
      const targetIndex = orderItems.findIndex((item) => normalizeText(item.name) === deletedName)
      if (targetIndex < 0) continue

      const nextItems = orderItems
        .map((item, index) => {
          if (index !== targetIndex) return item

          const currentQuantity = Number(item.quantity || 1)
          const nextQuantity = currentQuantity - Number(deletedItem.quantity || 1)

          return nextQuantity > 0 ? { ...item, quantity: nextQuantity } : null
        })
        .filter(Boolean) as NonNullable<AppOrder['items']>

      if (nextItems.length === 0) {
        const { error } = await supabase
          .from('app_orders')
          .update({
            status: 'cancelado',
            customer_message: 'Pedido cancelado pelo cafe.',
          })
          .eq('id', order.id)

        if (error) {
          setMessage(`Item removido, mas o pedido ainda aparece no app: ${error.message}`)
        }

        return
      }

      const nextTotal = nextItems.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0,
      )
      const { error } = await supabase
        .from('app_orders')
        .update({
          items: nextItems,
          total_amount: Number(nextTotal.toFixed(2)),
          customer_message: 'Um item do pedido foi cancelado pelo cafe.',
        })
        .eq('id', order.id)

      if (error) {
        setMessage(`Item removido, mas o pedido ainda aparece no app: ${error.message}`)
      }

      return
    }
  }

  const deleteAppPending = async (pending: PendingPayment) => {
    if (!isAdmin) return

    const confirmed = window.confirm(
      `Apagar o pedido do app de ${pending.customer_name}? Esta acao remove a pendencia financeira deste lancamento.`,
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('pending_payments')
      .delete()
      .eq('id', pending.id)

    if (error) {
      setMessage(`Nao foi possivel apagar o pedido do app: ${error.message}`)
      return
    }

    await syncDeletedPendingToAppOrder(pending)
    await syncDeletedPendingToSales(pending)
    setMessage(`Pedido do app de ${pending.customer_name} apagado.`)
    fetchPending()
  }

  const deletePendingItem = async (pending: PendingPayment, itemIndex: number) => {
    if (!isAdmin) return

    const items = splitPendingItems(pending.items_detail)
    const item = items[itemIndex]
    if (!item) return

    const fallbackAmount = Number(pending.total_amount || 0) / Math.max(items.length, 1)
    const itemAmount = getPendingItemAmount(item, fallbackAmount)
    const confirmed = window.confirm(`Apagar este item de ${pending.customer_name}: ${item}?`)
    if (!confirmed) return

    const nextItems = items.filter((_, index) => index !== itemIndex)

    if (nextItems.length === 0) {
      const { error } = await supabase
        .from('pending_payments')
        .update({
          status: 'cancelado',
          items_detail: '',
          total_amount: 0,
          description: `${pending.description || 'Pendencia'} (item cancelado pelo admin)`,
        })
        .eq('id', pending.id)

      if (error) {
        setMessage(`Nao foi possivel apagar o item: ${error.message}`)
        return
      }

      await syncDeletedPendingItemToAppOrder(pending, item)
      await syncDeletedPendingItemToSales(pending, item)
      setMessage(`Item apagado. Pendencia de ${pending.customer_name} removida porque ficou vazia.`)
      fetchPending()
      return
    }

    const nextTotal = Math.max(Number(pending.total_amount || 0) - itemAmount, 0)
    const { error } = await supabase
      .from('pending_payments')
      .update({
        items_detail: nextItems.join('; '),
        total_amount: Number(nextTotal.toFixed(2)),
      })
      .eq('id', pending.id)

    if (error) {
      setMessage(`Nao foi possivel apagar o item: ${error.message}`)
      return
    }

    await syncDeletedPendingItemToAppOrder(pending, item)
    await syncDeletedPendingItemToSales(pending, item)
    setMessage(`Item apagado de ${pending.customer_name}.`)
    fetchPending()
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

      <section className="add-form pdv-customer-section">
        <div className="pending-list-header">
          <div>
            <h2>Clientes PDV</h2>
            <p>Cadastre clientes que querem marcar compra sem usar o app.</p>
          </div>
          <label>
            Buscar cliente
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Nome, telefone ou observacao"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Nome
            <input
              value={newPdvCustomer.name}
              onChange={(event) =>
                setNewPdvCustomer({ ...newPdvCustomer, name: event.target.value })
              }
              placeholder="Nome completo"
              maxLength={60}
            />
          </label>
          <label>
            Telefone
            <input
              value={newPdvCustomer.phone}
              onChange={(event) =>
                setNewPdvCustomer({ ...newPdvCustomer, phone: event.target.value })
              }
              placeholder="Telefone"
              maxLength={25}
            />
          </label>
          <label>
            Cargo/Referencia
            <input
              value={newPdvCustomer.position}
              onChange={(event) =>
                setNewPdvCustomer({ ...newPdvCustomer, position: event.target.value })
              }
              placeholder="Empresa, cargo ou referencia"
              maxLength={40}
            />
          </label>
          <label>
            Observacao
            <input
              value={newPdvCustomer.notes}
              onChange={(event) =>
                setNewPdvCustomer({ ...newPdvCustomer, notes: event.target.value })
              }
              placeholder="Ex: cliente retira no balcão"
              maxLength={80}
            />
          </label>
        </div>
        <div className="pdv-customer-form-actions">
          <button type="button" className="btn-primary" onClick={savePdvCustomer}>
            {editingPdvCustomerId ? 'Salvar alteracoes' : 'Salvar cliente PDV'}
          </button>
          {editingPdvCustomerId && (
            <button type="button" className="btn-secondary" onClick={cancelPdvCustomerEdit}>
              Cancelar edicao
            </button>
          )}
        </div>

        <div className="pdv-customers-list">
          {filteredPdvCustomers.length === 0 ? (
            <p className="pending-empty">Nenhum cliente PDV cadastrado.</p>
          ) : (
            filteredPdvCustomers.map((customer) => (
              <article key={customer.id} className={`pdv-customer-card ${customer.status}`}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.phone}</span>
                  <small>{customer.position || 'Sem referencia'}</small>
                  {customer.notes && <small>{customer.notes}</small>}
                </div>
                <div className="pdv-customer-actions">
                  <button type="button" onClick={() => editPdvCustomer(customer)}>
                    Editar cadastro
                  </button>
                  <button type="button" onClick={() => selectPdvCustomerForPending(customer)}>
                    Usar na pendencia
                  </button>
                  {isAdmin && (
                    <button type="button" onClick={() => updatePdvCustomerStatus(customer)}>
                      {customer.status === 'ativo' ? 'Bloquear' : 'Ativar'}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-delete-pdv-customer"
                      onClick={() => deletePdvCustomer(customer)}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

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
              maxLength={25}
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
              maxLength={25}
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
              maxLength={25}
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
            <div className="consumed-item-entry">
              <input
                value={pendingItem}
                onChange={(e) => setPendingItem(e.target.value)}
                placeholder="Ex: Cafe expresso"
                maxLength={25}
              />
              <button type="button" onClick={addPendingItem}>Adicionar</button>
            </div>
            <div className="consumed-items-list">
              {pendingItems.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingItems((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remover
                  </button>
                </span>
              ))}
            </div>
          </label>
          <label className="wide">
            Observacao
            <input
              value={newPending.description}
              onChange={(e) =>
                setNewPending({ ...newPending, description: e.target.value })
              }
              placeholder="Observacao"
              maxLength={25}
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
        <div className="pending-list-header">
          <div>
            <h2>Contas pendentes - R$ {totalPending.toFixed(2)}</h2>
            <p>{Object.keys(groupedPending).length} cliente(s) em aberto na lista.</p>
          </div>
          <label>
            Buscar
            <div className="pending-search-actions">
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setSearchTerm(event.target.value.trim())
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch()
                }}
                placeholder="Nome, telefone, cargo ou item"
              />
              <button type="button" onClick={applySearch}>Buscar</button>
              {searchTerm && <button type="button" onClick={clearSearch}>Limpar</button>}
            </div>
          </label>
        </div>
        <div className="pending-groups">
          {Object.entries(groupedPending).length === 0 && (
            <p className="pending-empty">Nenhuma pendencia encontrada.</p>
          )}
          {Object.entries(groupedPending).map(([key, entries]) => {
            const first = entries[0]
            const personTotal = entries.reduce((sum, entry) => sum + Number(entry.total_amount), 0)
            const isExpanded = Boolean(expandedPendingGroups[key])

            return (
              <section key={key} className={`pending-person ${isExpanded ? 'expanded' : ''}`}>
                <div className="person-header">
                  <div>
                    <h3>{first.customer_name}</h3>
                    <p>{first.phone} - {first.position || 'Sem cargo'}</p>
                  </div>
                  <div className="person-summary">
                    <span>Aberto</span>
                    <strong>R$ {personTotal.toFixed(2)}</strong>
                  </div>
                  <button type="button" onClick={() => togglePendingGroup(key)}>
                    {isExpanded ? 'Ocultar' : 'Consultar'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="pending-person-details">
                    <div className="pending-person-actions">
                      <button type="button" onClick={() => markCustomerAsPaid(entries)}>
                        Marcar tudo como pago
                      </button>
                    </div>
                    <div className="pending-grid">
                  {entries.map((pending) => (
                    <article key={pending.id} className={`pending-card ${pending.status}`}>
                      <div className="card-header">
                        <h3>{pending.status}</h3>
                        <span>R$ {Number(pending.total_amount).toFixed(2)}</span>
                      </div>
                      <p><strong>Compra:</strong> {formatLocalDate(pending.purchase_date)}</p>
                      <p><strong>Pagamento:</strong> {formatLocalDate(pending.due_date)}</p>
                      <div className="consumed-history">
                        <strong>Consumiu:</strong>
                        {splitPendingItems(pending.items_detail).map((item, index) => (
                          <span key={`${pending.id}-${index}`}>
                            {item}
                            {isAdmin && (
                              <button
                                type="button"
                                className="btn-delete-pending-item"
                                onClick={() => deletePendingItem(pending, index)}
                              >
                                Excluir item
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      <p><strong>Observacao:</strong> {pending.description || '-'}</p>
                      <p className="payment-only">Somente Pix ou dinheiro</p>
                      {isAdmin && isAppPendingPayment(pending) && (
                        <button
                          type="button"
                          className="btn-delete-pending-app"
                          onClick={() => deleteAppPending(pending)}
                        >
                          Apagar pedido app
                        </button>
                      )}
                    </article>
                  ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </section>
      <button type="button" className="pending-scroll-top" onClick={scrollToTop}>
        Voltar ao topo
      </button>
    </div>
  )
}
