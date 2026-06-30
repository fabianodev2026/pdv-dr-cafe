import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CashClosingManager.css'

interface CurrentUser {
  username: string
  role: string
}

interface CashClosingManagerProps {
  currentUser?: CurrentUser
}

interface Denomination {
  key: string
  label: string
  value: number
  group: 'notas' | 'moedas'
}

interface CashClosing {
  id: number
  closing_date: string
  opening_cashier_name?: string
  cashier_name: string
  opening_cash: number
  cash_in_day?: number
  cash_expenses?: number
  counted_cash: number
  card_total: number
  credit_total?: number
  debit_total?: number
  pix_total: number
  grand_total: number
  cash_difference: number
  notes_detail: Record<string, number>
  coins_detail: Record<string, number>
  created_at: string
}

interface PendingPayment {
  id: number
  created_at: string
  customer_name: string
  phone?: string
  position?: string
  description?: string
  items_detail?: string
  total_amount: number
  purchase_date: string
  due_date: string
  status: string
}

interface SaleMovement {
  total_amount: number
  payment_method?: string | null
}

const denominations: Denomination[] = [
  { key: 'n100', label: 'Nota R$ 100', value: 100, group: 'notas' },
  { key: 'n50', label: 'Nota R$ 50', value: 50, group: 'notas' },
  { key: 'n20', label: 'Nota R$ 20', value: 20, group: 'notas' },
  { key: 'n10', label: 'Nota R$ 10', value: 10, group: 'notas' },
  { key: 'n5', label: 'Nota R$ 5', value: 5, group: 'notas' },
  { key: 'n2', label: 'Nota R$ 2', value: 2, group: 'notas' },
  { key: 'm1', label: 'Moeda R$ 1', value: 1, group: 'moedas' },
  { key: 'm050', label: 'Moeda R$ 0,50', value: 0.5, group: 'moedas' },
  { key: 'm025', label: 'Moeda R$ 0,25', value: 0.25, group: 'moedas' },
  { key: 'm010', label: 'Moeda R$ 0,10', value: 0.1, group: 'moedas' },
  { key: 'm005', label: 'Moeda R$ 0,05', value: 0.05, group: 'moedas' },
]

const initialCounts = Object.fromEntries(denominations.map((item) => [item.key, '']))
const CASH_CLOSING_DRAFT_KEY = 'dr-cafe-cash-closing-draft'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const today = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const getMonthButtons = (baseMonth: string) => {
  const [year] = baseMonth.split('-').map(Number)
  return monthNames.map((label, index) => ({
    label,
    value: `${year}-${String(index + 1).padStart(2, '0')}`,
  }))
}
const getMonthRange = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 1)
  const endYear = endDate.getFullYear()
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')
  return { start, end: `${endYear}-${endMonth}-01` }
}
const formatClosingDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
const addDaysToDate = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const toMoney = (value: number) => Number(value.toFixed(2))
const toNumber = (value: string) => Number(value.replace(',', '.') || 0)

export default function CashClosingManager({ currentUser }: CashClosingManagerProps) {
  const [closingDate, setClosingDate] = useState(today())
  const [openingCashierName, setOpeningCashierName] = useState(currentUser?.username || '')
  const [openingCash, setOpeningCash] = useState('')
  const [cashInDay, setCashInDay] = useState('0')
  const [cashExpenses, setCashExpenses] = useState('')
  const [creditTotal, setCreditTotal] = useState('')
  const [debitTotal, setDebitTotal] = useState('')
  const [pixTotal, setPixTotal] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>(initialCounts)
  const [closings, setClosings] = useState<CashClosing[]>([])
  const [closingReportMonth, setClosingReportMonth] = useState(getMonthInputValue())
  const [selectedClosingDate, setSelectedClosingDate] = useState('')
  const [payLaterMovements, setPayLaterMovements] = useState<PendingPayment[]>([])
  const [monthlyPayLaterMovements, setMonthlyPayLaterMovements] = useState<PendingPayment[]>([])
  const [message, setMessage] = useState('')
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingMovement, setIsLoadingMovement] = useState(false)

  const notes = denominations.filter((item) => item.group === 'notas')
  const coins = denominations.filter((item) => item.group === 'moedas')

  const countedCash = useMemo(
    () =>
      toMoney(
        denominations.reduce(
          (sum, item) => sum + (Number.parseInt(counts[item.key] || '0', 10) || 0) * item.value,
          0,
        ),
      ),
    [counts],
  )

  const openingCashValue = toMoney(toNumber(openingCash))
  const cashInDayValue = toMoney(toNumber(cashInDay))
  const cashExpensesValue = toMoney(toNumber(cashExpenses))
  const creditTotalValue = toMoney(toNumber(creditTotal))
  const debitTotalValue = toMoney(toNumber(debitTotal))
  const cardTotalValue = toMoney(creditTotalValue + debitTotalValue)
  const pixTotalValue = toMoney(toNumber(pixTotal))
  const expectedCash = toMoney(openingCashValue + cashInDayValue - cashExpensesValue)
  const grandTotal = toMoney(cashInDayValue + cardTotalValue + pixTotalValue)
  const cashDifference = toMoney(countedCash - expectedCash)
  const payLaterTotal = toMoney(
    payLaterMovements.reduce((sum, payment) => sum + Number(payment.total_amount || 0), 0),
  )
  const monthlyPayLaterTotal = toMoney(
    monthlyPayLaterMovements.reduce(
      (sum, payment) => sum + Number(payment.total_amount || 0),
      0,
    ),
  )
  const monthlyClosingSummary = useMemo(
    () =>
      closings.reduce(
        (totals, closing) => ({
          days: totals.days + 1,
          cash: toMoney(totals.cash + Number(closing.cash_in_day || 0)),
          expenses: toMoney(totals.expenses + Number(closing.cash_expenses || 0)),
          credit: toMoney(totals.credit + Number(closing.credit_total ?? closing.card_total ?? 0)),
          debit: toMoney(totals.debit + Number(closing.debit_total || 0)),
          pix: toMoney(totals.pix + Number(closing.pix_total || 0)),
          total: toMoney(totals.total + Number(closing.grand_total || 0)),
        }),
        { days: 0, cash: 0, expenses: 0, credit: 0, debit: 0, pix: 0, total: 0 },
      ),
    [closings],
  )
  const monthButtons = useMemo(() => getMonthButtons(closingReportMonth), [closingReportMonth])
  const selectedClosing = useMemo(
    () =>
      closings.find((closing) => closing.closing_date === selectedClosingDate) ??
      closings[0] ??
      null,
    [closings, selectedClosingDate],
  )
  const selectedClosingPayLaterMovements = useMemo(
    () =>
      selectedClosing
        ? monthlyPayLaterMovements.filter(
            (payment) => payment.purchase_date === selectedClosing.closing_date,
          )
        : [],
    [monthlyPayLaterMovements, selectedClosing],
  )
  const selectedClosingPayLaterTotal = toMoney(
    selectedClosingPayLaterMovements.reduce(
      (sum, payment) => sum + Number(payment.total_amount || 0),
      0,
    ),
  )

  const fetchClosings = async (monthValue = closingReportMonth) => {
    const { start, end } = getMonthRange(monthValue)
    const { data, error } = await supabase
      .from('cash_closings')
      .select('*')
      .gte('closing_date', start)
      .lt('closing_date', end)
      .order('closing_date', { ascending: false })

    if (error) {
      console.error('Erro ao buscar fechamentos de caixa:', error)
      setMessage('Execute o SQL de fechamento de caixa no Supabase antes de usar esta aba.')
      return
    }

    setClosings(data ?? [])
  }

  const fetchPayLaterMovements = async (date = closingDate) => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select('id, created_at, customer_name, phone, position, description, items_detail, total_amount, purchase_date, due_date, status')
      .eq('purchase_date', date)
      .order('customer_name', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar pagar depois do fechamento:', error)
      setPayLaterMovements([])
      return
    }

    setPayLaterMovements(data ?? [])
  }

  const fetchMonthlyPayLaterMovements = async (monthValue = closingReportMonth) => {
    const { start, end } = getMonthRange(monthValue)
    const { data, error } = await supabase
      .from('pending_payments')
      .select('id, created_at, customer_name, phone, position, description, items_detail, total_amount, purchase_date, due_date, status')
      .gte('purchase_date', start)
      .lt('purchase_date', end)
      .order('purchase_date', { ascending: false })
      .order('customer_name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar pagar depois mensal:', error)
      setMonthlyPayLaterMovements([])
      return
    }

    setMonthlyPayLaterMovements(data ?? [])
  }

  const loadDailyMovementTotals = async (date = closingDate, showSuccessMessage = false) => {
    const startDate = new Date(`${date}T00:00:00`)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)

    setIsLoadingMovement(true)
    const { data, error } = await supabase
      .from('sales')
      .select('total_amount, payment_method')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())

    setIsLoadingMovement(false)

    if (error) {
      console.error('Erro ao buscar movimento automatico:', error)
      setMessage(`Nao foi possivel puxar movimento automatico: ${error.message}`)
      return
    }

    const totals = ((data ?? []) as SaleMovement[]).reduce(
      (summary, sale) => {
        const amount = Number(sale.total_amount || 0)
        const method = String(sale.payment_method || '').toLowerCase()

        if (method === 'dinheiro') summary.cash += amount
        if (method === 'credito') summary.credit += amount
        if (method === 'debito') summary.debit += amount
        if (method === 'pix') summary.pix += amount

        return summary
      },
      { cash: 0, credit: 0, debit: 0, pix: 0 },
    )

    setCashInDay(String(toMoney(totals.cash)))
    setCreditTotal(String(toMoney(totals.credit)))
    setDebitTotal(String(toMoney(totals.debit)))
    setPixTotal(String(toMoney(totals.pix)))

    if (showSuccessMessage) {
      setMessage(`Movimento de ${formatClosingDate(date)} puxado do PDV automaticamente.`)
    }
  }

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(CASH_CLOSING_DRAFT_KEY)
      if (!savedDraft) return

      const draft = JSON.parse(savedDraft)
      setClosingDate(draft.closingDate || today())
      setOpeningCashierName(draft.openingCashierName || currentUser?.username || '')
      setOpeningCash(draft.openingCash || '')
      setCashInDay(draft.cashInDay || '0')
      setCashExpenses(draft.cashExpenses || '')
      setCreditTotal(draft.creditTotal || draft.cardTotal || '')
      setDebitTotal(draft.debitTotal || '')
      setPixTotal(draft.pixTotal || '')
      setCounts({ ...initialCounts, ...(draft.counts || {}) })
    } catch {
      localStorage.removeItem(CASH_CLOSING_DRAFT_KEY)
    } finally {
      setIsDraftLoaded(true)
    }
  }, [currentUser?.username])

  useEffect(() => {
    fetchClosings(closingReportMonth)
    fetchMonthlyPayLaterMovements(closingReportMonth)
  }, [closingReportMonth])

  useEffect(() => {
    fetchPayLaterMovements(closingDate)
  }, [closingDate])

  useEffect(() => {
    if (closings.length === 0) {
      setSelectedClosingDate('')
      return
    }

    const selectedStillExists = closings.some(
      (closing) => closing.closing_date === selectedClosingDate,
    )
    if (!selectedStillExists) {
      setSelectedClosingDate(closings[0].closing_date)
    }
  }, [closings, selectedClosingDate])

  useEffect(() => {
    if (!isDraftLoaded) return
    const latestForDate = closings.find((closing) => closing.closing_date === closingDate)
    if (latestForDate) return

    loadDailyMovementTotals(closingDate)
  }, [closingDate, closings, isDraftLoaded])

  useEffect(() => {
    if (!isDraftLoaded) return

    localStorage.setItem(
      CASH_CLOSING_DRAFT_KEY,
      JSON.stringify({
        closingDate,
        openingCashierName,
        openingCash,
        cashInDay,
        cashExpenses,
        creditTotal,
        debitTotal,
        pixTotal,
        counts,
      }),
    )
  }, [
    cashInDay,
    cashExpenses,
    closingDate,
    counts,
    creditTotal,
    debitTotal,
    isDraftLoaded,
    openingCash,
    openingCashierName,
    pixTotal,
  ])

  useEffect(() => {
    const latestForDate = closings.find((closing) => closing.closing_date === closingDate)
    if (!latestForDate) return

    const nextCounts = denominations.reduce<Record<string, string>>((detail, item) => {
      const source =
        item.group === 'notas' ? latestForDate.notes_detail : latestForDate.coins_detail
      detail[item.key] = source?.[item.key] ? String(source[item.key]) : ''
      return detail
    }, {})

    setOpeningCashierName(latestForDate.opening_cashier_name || currentUser?.username || '')
    setOpeningCash(String(Number(latestForDate.opening_cash || 0)))
    setCashInDay(String(Number(latestForDate.cash_in_day || 0)))
    setCashExpenses(String(Number(latestForDate.cash_expenses || 0)))
    setCreditTotal(String(Number(latestForDate.credit_total ?? latestForDate.card_total ?? 0)))
    setDebitTotal(String(Number(latestForDate.debit_total || 0)))
    setPixTotal(String(Number(latestForDate.pix_total || 0)))
    setCounts({ ...initialCounts, ...nextCounts })
  }, [closingDate, closings, currentUser?.username])

  const updateCount = (key: string, value: string) => {
    setCounts((current) => ({
      ...current,
      [key]: value.replace(/\D/g, ''),
    }))
  }

  const buildDetail = (group: 'notas' | 'moedas') =>
    denominations
      .filter((item) => item.group === group)
      .reduce<Record<string, number>>((detail, item) => {
        detail[item.key] = Number.parseInt(counts[item.key] || '0', 10) || 0
        return detail
      }, {})

  const saveClosing = async (
    successMessage = 'Fechamento de caixa salvo com sucesso.',
    resetForNextDay = false,
  ) => {
    if (isSaving) return

    const notesDetail = buildDetail('notas')
    const coinsDetail = buildDetail('moedas')
    const payload = {
      closing_date: closingDate,
      opening_cashier_name: openingCashierName.trim() || currentUser?.username || 'Desconhecido',
      cashier_name: currentUser?.username || 'Desconhecido',
      opening_cash: openingCashValue,
      cash_in_day: cashInDayValue,
      cash_expenses: cashExpensesValue,
      counted_cash: countedCash,
      card_total: cardTotalValue,
      credit_total: creditTotalValue,
      debit_total: debitTotalValue,
      pix_total: pixTotalValue,
      grand_total: grandTotal,
      cash_difference: cashDifference,
      notes_detail: notesDetail,
      coins_detail: coinsDetail,
    }

    setIsSaving(true)
    setMessage('Salvando fechamento de caixa...')

    try {
      const { error } = await supabase
        .from('cash_closings')
        .upsert([payload], { onConflict: 'closing_date' })

      if (error) {
        setMessage(`Nao foi possivel salvar o fechamento: ${error.message}`)
        return
      }

      const savedMonth = closingDate.slice(0, 7)
      setClosingReportMonth(savedMonth)
      await fetchClosings(savedMonth)
      await fetchMonthlyPayLaterMovements(savedMonth)
      if (resetForNextDay) {
        const nextClosingDate = addDaysToDate(closingDate, 1)
        setClosingDate(nextClosingDate)
        setOpeningCash(String(countedCash))
        setCashInDay('0')
        setCashExpenses('')
        setCreditTotal('')
        setDebitTotal('')
        setPixTotal('')
        setMessage(
          `${successMessage} Dinheiro do dia, cartao e Pix zerados para ${formatClosingDate(nextClosingDate)}. ` +
            `Dinheiro mantido como abertura: ${currencyFormatter.format(countedCash)}.`,
        )
        return
      }

      setMessage(`${successMessage} ${new Date().toLocaleTimeString('pt-BR')}`)
    } catch (error) {
      setMessage(
        `Nao foi possivel salvar o fechamento: ${
          error instanceof Error ? error.message : 'erro inesperado'
        }`,
      )
    } finally {
      setIsSaving(false)
    }
  }

  const saveOpening = async () => {
    await saveClosing('Caixa aberto com sucesso.')
  }

  const closeDay = async () => {
    const confirmed = window.confirm('Deseja fechar o dia?')
    if (!confirmed) return

    await saveClosing('Fechamento de caixa salvo com sucesso.', true)
  }

  const renderDenomination = (item: Denomination) => {
    const quantity = Number.parseInt(counts[item.key] || '0', 10) || 0
    return (
      <label key={item.key} className="cash-denomination">
        <span>{item.label}</span>
        <input
          value={counts[item.key]}
          onChange={(event) => updateCount(item.key, event.target.value)}
          inputMode="numeric"
          placeholder="0"
        />
        <strong>{currencyFormatter.format(toMoney(quantity * item.value))}</strong>
      </label>
    )
  }

  const renderDenominationGroup = (group: 'notas' | 'moedas', title: string) => (
    <div className="cash-denomination-group">
      <div className="cash-section-title">{title}</div>
      <div className="cash-denominations-grid">
        {denominations.filter((item) => item.group === group).map(renderDenomination)}
      </div>
    </div>
  )

  const printClosing = () => {
    document.body.classList.add('printing-cash-closing')
    const clearPrintMode = () => {
      document.body.classList.remove('printing-cash-closing')
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

  return (
    <div className="cash-closing-page">
      <header className="cash-closing-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Fechamento de caixa</h1>
          <p>Abertura, contagem do dinheiro, cartao, Pix e total do dia.</p>
        </div>
      </header>

      {message && <div className="cash-closing-message">{message}</div>}

      <section className="cash-closing-summary">
        <label>
          Data do fechamento
          <input
            type="date"
            value={closingDate}
            onChange={(event) => setClosingDate(event.target.value)}
          />
        </label>
        <label>
          Quem abriu o caixa
          <input
            value={openingCashierName}
            onChange={(event) => setOpeningCashierName(event.target.value)}
            placeholder="Nome de quem abriu"
            maxLength={40}
          />
        </label>
        <div>
          <span>Dinheiro contado</span>
          <strong>{currencyFormatter.format(countedCash)}</strong>
        </div>
        <div>
          <span>Dinheiro esperado</span>
          <strong>{currencyFormatter.format(expectedCash)}</strong>
        </div>
        <div>
          <span>Total vendido no dia</span>
          <strong>{currencyFormatter.format(grandTotal)}</strong>
        </div>
        <div>
          <span>Pagar depois do dia</span>
          <strong>{currencyFormatter.format(payLaterTotal)}</strong>
        </div>
        <div className={cashDifference < 0 ? 'negative' : 'positive'}>
          <span>Diferenca do dinheiro</span>
          <strong>{currencyFormatter.format(cashDifference)}</strong>
        </div>
      </section>

      <section className="cash-closing-columns">
        <div className="cash-closing-column">
          <h2>Dinheiro</h2>
          <div className="cash-money-grid">
            <label className="cash-money-input">
              Abertura em dinheiro
              <input
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
          </div>
          <div className="cash-column-total">
            <span>Dinheiro esperado</span>
            <strong>{currencyFormatter.format(expectedCash)}</strong>
          </div>
          <div className="cash-count-layout">
            {renderDenominationGroup('notas', 'Notas')}
            {renderDenominationGroup('moedas', 'Moedas')}
          </div>
        </div>

        <div className="cash-closing-column">
          <div className="cash-column-heading">
            <div>
              <h2>Movimento do dia</h2>
              <p>Dinheiro, cartao e Pix puxados das vendas registradas no PDV.</p>
            </div>
            <button
              type="button"
              onClick={() => loadDailyMovementTotals(closingDate, true)}
              disabled={isLoadingMovement}
            >
              {isLoadingMovement ? 'Atualizando...' : 'Atualizar pelo PDV'}
            </button>
          </div>
          <div className="cash-money-grid">
            <label className="cash-money-input">
              Dinheiro do dia
              <input
                value={cashInDay}
                onChange={(event) => setCashInDay(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label className="cash-money-input">
              Despesas do dia
              <input
                value={cashExpenses}
                onChange={(event) => setCashExpenses(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label className="cash-money-input">
              Credito
              <input
                value={creditTotal}
                onChange={(event) => setCreditTotal(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label className="cash-money-input">
              Debito
              <input
                value={debitTotal}
                onChange={(event) => setDebitTotal(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label className="cash-money-input">
              Pix
              <input
                value={pixTotal}
                onChange={(event) => setPixTotal(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
          </div>
          <div className="cash-column-total">
            <span>Total cartao</span>
            <strong>{currencyFormatter.format(cardTotalValue)}</strong>
          </div>
          <div className="cash-column-total cash-column-total--grand">
            <span>Total</span>
            <strong>{currencyFormatter.format(grandTotal)}</strong>
          </div>
        </div>
      </section>

      <section className="cash-pay-later-panel">
        <div className="cash-pay-later-heading">
          <div>
            <h2>Pagar depois do dia</h2>
            <p>Compras lancadas para pagamento posterior nesta data.</p>
          </div>
          <strong>{currencyFormatter.format(payLaterTotal)}</strong>
        </div>
        {payLaterMovements.length === 0 ? (
          <p className="cash-pay-later-empty">Nenhum pagar depois lancado nesta data.</p>
        ) : (
          <div className="cash-pay-later-list">
            {payLaterMovements.map((payment) => (
              <article key={payment.id} className="cash-pay-later-card">
                <div>
                  <strong>{payment.customer_name || 'Cliente nao informado'}</strong>
                  <span>{payment.description || 'Pagar depois'}</span>
                  {payment.phone && <span>Telefone: {payment.phone}</span>}
                  <span>Vencimento: {formatClosingDate(payment.due_date)}</span>
                </div>
                <p>{payment.items_detail || '-'}</p>
                <b>{currencyFormatter.format(Number(payment.total_amount || 0))}</b>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="cash-closing-actions">
        <button type="button" onClick={saveOpening} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Abrir caixa'}
        </button>
        <button type="button" onClick={closeDay} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Fechar o dia'}
        </button>
        <button type="button" onClick={printClosing} className="cash-print-button">
          Imprimir / salvar PDF
        </button>
      </section>

      <section className="cash-closing-print">
        <div className="cash-print-header">
          <img src="/logo.jpeg" alt="Dr. Cafe" />
          <div>
            <h1>Fechamento de caixa</h1>
            <p>Dr. Cafe</p>
            <span>Data: {formatClosingDate(closingDate)}</span>
          </div>
        </div>
        <div className="cash-print-meta">
          <span>Aberto por: <strong>{openingCashierName || '-'}</strong></span>
          <span>Fechado por: <strong>{currentUser?.username || 'Desconhecido'}</strong></span>
          <span>Emitido em: <strong>{new Date().toLocaleString('pt-BR')}</strong></span>
        </div>
        <div className="cash-print-kpis">
          <div>
            <span>Abertura</span>
            <strong>{currencyFormatter.format(openingCashValue)}</strong>
          </div>
          <div>
            <span>Dinheiro do dia</span>
            <strong>{currencyFormatter.format(cashInDayValue)}</strong>
          </div>
          <div>
            <span>Despesas</span>
            <strong>{currencyFormatter.format(cashExpensesValue)}</strong>
          </div>
          <div>
            <span>Dinheiro contado</span>
            <strong>{currencyFormatter.format(countedCash)}</strong>
          </div>
          <div>
            <span>Credito</span>
            <strong>{currencyFormatter.format(creditTotalValue)}</strong>
          </div>
          <div>
            <span>Debito</span>
            <strong>{currencyFormatter.format(debitTotalValue)}</strong>
          </div>
          <div>
            <span>Pix</span>
            <strong>{currencyFormatter.format(pixTotalValue)}</strong>
          </div>
          <div>
            <span>Pagar depois</span>
            <strong>{currencyFormatter.format(payLaterTotal)}</strong>
          </div>
          <div>
            <span>Diferenca</span>
            <strong>{currencyFormatter.format(cashDifference)}</strong>
          </div>
          <div className="cash-print-total">
            <span>Total vendido</span>
            <strong>{currencyFormatter.format(grandTotal)}</strong>
          </div>
        </div>
        <div className="cash-print-grid">
          <div className="cash-print-panel">
            <h3>Notas</h3>
            {notes.map((item) => (
              <div key={item.key} className="cash-print-row">
                <span>{item.label}</span>
                <strong>{Number.parseInt(counts[item.key] || '0', 10) || 0}</strong>
                <b>
                  {currencyFormatter.format(
                    toMoney((Number.parseInt(counts[item.key] || '0', 10) || 0) * item.value),
                  )}
                </b>
              </div>
            ))}
          </div>
          <div className="cash-print-panel">
            <h3>Moedas</h3>
            {coins.map((item) => (
              <div key={item.key} className="cash-print-row">
                <span>{item.label}</span>
                <strong>{Number.parseInt(counts[item.key] || '0', 10) || 0}</strong>
                <b>
                  {currencyFormatter.format(
                    toMoney((Number.parseInt(counts[item.key] || '0', 10) || 0) * item.value),
                  )}
                </b>
              </div>
            ))}
          </div>
          <div className="cash-print-panel">
            <h3>Conferencia</h3>
            <div className="cash-print-row">
              <span>Dinheiro esperado</span>
              <strong />
              <b>{currencyFormatter.format(expectedCash)}</b>
            </div>
            <div className="cash-print-row">
              <span>Dinheiro contado</span>
              <strong />
              <b>{currencyFormatter.format(countedCash)}</b>
            </div>
            <div className="cash-print-row">
              <span>Diferenca</span>
              <strong />
              <b>{currencyFormatter.format(cashDifference)}</b>
            </div>
            <div className="cash-print-signature">
              <span>Assinatura do responsavel</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cash-closing-history">
        <div className="cash-closing-history-heading">
          <div>
            <h2>Fechamentos do mes</h2>
            <p>Consulte meses ja fechados para relatorio mensal.</p>
          </div>
          <strong>{closingReportMonth.split('-')[0]}</strong>
        </div>
        <div className="cash-month-buttons" aria-label="Meses do relatorio">
          {monthButtons.map((month) => (
            <button
              key={month.value}
              type="button"
              className={month.value === closingReportMonth ? 'active' : ''}
              onClick={() => setClosingReportMonth(month.value)}
            >
              {month.label}
            </button>
          ))}
        </div>
        <div className="cash-month-summary">
          <article>
            <span>Dias fechados</span>
            <strong>{monthlyClosingSummary.days}</strong>
          </article>
          <article>
            <span>Dinheiro do mes</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.cash)}</strong>
          </article>
          <article>
            <span>Despesas do mes</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.expenses)}</strong>
          </article>
          <article>
            <span>Credito</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.credit)}</strong>
          </article>
          <article>
            <span>Debito</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.debit)}</strong>
          </article>
          <article>
            <span>Pix</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.pix)}</strong>
          </article>
          <article>
            <span>Pagar depois do mes</span>
            <strong>{currencyFormatter.format(monthlyPayLaterTotal)}</strong>
          </article>
          <article>
            <span>Total do mes</span>
            <strong>{currencyFormatter.format(monthlyClosingSummary.total)}</strong>
          </article>
        </div>
        {closings.length === 0 ? (
          <p>Nenhum fechamento salvo para este mes.</p>
        ) : (
          <>
            <div className="cash-closing-calendar" aria-label="Dias fechados no mes">
              {closings.map((closing) => (
                <button
                  key={closing.id}
                  type="button"
                  className={closing.closing_date === selectedClosing?.closing_date ? 'active' : ''}
                  onClick={() => setSelectedClosingDate(closing.closing_date)}
                >
                  <span>{new Date(`${closing.closing_date}T12:00:00`).getDate()}</span>
                  <strong>{currencyFormatter.format(Number(closing.grand_total))}</strong>
                </button>
              ))}
            </div>
            {selectedClosing && (
              <article className="cash-history-card cash-history-card--selected">
                <strong>{formatClosingDate(selectedClosing.closing_date)}</strong>
                <span>Abertura: {selectedClosing.opening_cashier_name || '-'}</span>
                <span>Caixa: {selectedClosing.cashier_name}</span>
                <span>Dinheiro contado: {currencyFormatter.format(Number(selectedClosing.counted_cash))}</span>
                <span>Dinheiro dia: {currencyFormatter.format(Number(selectedClosing.cash_in_day || 0))}</span>
                <span>Despesas: {currencyFormatter.format(Number(selectedClosing.cash_expenses || 0))}</span>
                <span>Credito: {currencyFormatter.format(Number(selectedClosing.credit_total ?? selectedClosing.card_total ?? 0))}</span>
                <span>Debito: {currencyFormatter.format(Number(selectedClosing.debit_total || 0))}</span>
                <span>Pix: {currencyFormatter.format(Number(selectedClosing.pix_total))}</span>
                <span>Pagar depois: {currencyFormatter.format(selectedClosingPayLaterTotal)}</span>
                <span>Diferenca: {currencyFormatter.format(Number(selectedClosing.cash_difference || 0))}</span>
                <b>Total: {currencyFormatter.format(Number(selectedClosing.grand_total))}</b>
              </article>
            )}
            {selectedClosing && (
              <section className="cash-history-pay-later">
                <div className="cash-pay-later-heading">
                  <div>
                    <h3>Pagar depois em {formatClosingDate(selectedClosing.closing_date)}</h3>
                    <p>Itens marcados para pagamento posterior neste dia.</p>
                  </div>
                  <strong>{currencyFormatter.format(selectedClosingPayLaterTotal)}</strong>
                </div>
                {selectedClosingPayLaterMovements.length === 0 ? (
                  <p className="cash-pay-later-empty">Nenhum pagar depois neste dia.</p>
                ) : (
                  <div className="cash-pay-later-list">
                    {selectedClosingPayLaterMovements.map((payment) => (
                      <article key={payment.id} className="cash-pay-later-card">
                        <div>
                          <strong>{payment.customer_name || 'Cliente nao informado'}</strong>
                          <span>{payment.description || 'Pagar depois'}</span>
                          {payment.phone && <span>Telefone: {payment.phone}</span>}
                          <span>Status: {payment.status || 'pendente'}</span>
                        </div>
                        <p>{payment.items_detail || '-'}</p>
                        <b>{currencyFormatter.format(Number(payment.total_amount || 0))}</b>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  )
}
