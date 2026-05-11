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
  counted_cash: number
  card_total: number
  pix_total: number
  grand_total: number
  cash_difference: number
  notes_detail: Record<string, number>
  coins_detail: Record<string, number>
  created_at: string
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

const today = () => new Date().toISOString().slice(0, 10)
const toMoney = (value: number) => Number(value.toFixed(2))
const toNumber = (value: string) => Number(value.replace(',', '.') || 0)

export default function CashClosingManager({ currentUser }: CashClosingManagerProps) {
  const [closingDate, setClosingDate] = useState(today())
  const [openingCashierName, setOpeningCashierName] = useState(currentUser?.username || '')
  const [openingCash, setOpeningCash] = useState('')
  const [cardTotal, setCardTotal] = useState('')
  const [pixTotal, setPixTotal] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>(initialCounts)
  const [closings, setClosings] = useState<CashClosing[]>([])
  const [message, setMessage] = useState('')
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)

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
  const cardTotalValue = toMoney(toNumber(cardTotal))
  const pixTotalValue = toMoney(toNumber(pixTotal))
  const grandTotal = toMoney(countedCash + cardTotalValue + pixTotalValue)
  const cashDifference = toMoney(countedCash - openingCashValue)

  const fetchClosings = async () => {
    const { data, error } = await supabase
      .from('cash_closings')
      .select('*')
      .order('closing_date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Erro ao buscar fechamentos de caixa:', error)
      return
    }

    setClosings(data ?? [])
  }

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(CASH_CLOSING_DRAFT_KEY)
      if (!savedDraft) return

      const draft = JSON.parse(savedDraft)
      setClosingDate(draft.closingDate || today())
      setOpeningCashierName(draft.openingCashierName || currentUser?.username || '')
      setOpeningCash(draft.openingCash || '')
      setCardTotal(draft.cardTotal || '')
      setPixTotal(draft.pixTotal || '')
      setCounts({ ...initialCounts, ...(draft.counts || {}) })
    } catch {
      localStorage.removeItem(CASH_CLOSING_DRAFT_KEY)
    } finally {
      setIsDraftLoaded(true)
    }
  }, [currentUser?.username])

  useEffect(() => {
    fetchClosings()
  }, [])

  useEffect(() => {
    if (!isDraftLoaded) return

    localStorage.setItem(
      CASH_CLOSING_DRAFT_KEY,
      JSON.stringify({
        closingDate,
        openingCashierName,
        openingCash,
        cardTotal,
        pixTotal,
        counts,
      }),
    )
  }, [
    cardTotal,
    closingDate,
    counts,
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
    setCardTotal(String(Number(latestForDate.card_total || 0)))
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

  const saveClosing = async () => {
    const notesDetail = buildDetail('notas')
    const coinsDetail = buildDetail('moedas')
    const payload = {
      closing_date: closingDate,
      opening_cashier_name: openingCashierName.trim() || currentUser?.username || 'Desconhecido',
      cashier_name: currentUser?.username || 'Desconhecido',
      opening_cash: openingCashValue,
      counted_cash: countedCash,
      card_total: cardTotalValue,
      pix_total: pixTotalValue,
      grand_total: grandTotal,
      cash_difference: cashDifference,
      notes_detail: notesDetail,
      coins_detail: coinsDetail,
    }

    const { error } = await supabase.from('cash_closings').insert([payload])

    if (error) {
      setMessage(`Nao foi possivel salvar o fechamento: ${error.message}`)
      return
    }

    setMessage('Fechamento de caixa salvo com sucesso.')
    fetchClosings()
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
          <span>Total geral</span>
          <strong>{currencyFormatter.format(grandTotal)}</strong>
        </div>
        <div className={cashDifference < 0 ? 'negative' : 'positive'}>
          <span>Diferenca do dinheiro</span>
          <strong>{currencyFormatter.format(cashDifference)}</strong>
        </div>
      </section>

      <section className="cash-closing-columns">
        <div className="cash-closing-column">
          <h2>Dinheiro</h2>
          <label className="cash-money-input">
            Abertura em dinheiro
            <input
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <div className="cash-section-title">Notas</div>
          {notes.map(renderDenomination)}
          <div className="cash-section-title">Moedas</div>
          {coins.map(renderDenomination)}
        </div>

        <div className="cash-closing-column">
          <h2>Cartao</h2>
          <label className="cash-money-input">
            Total em cartao
            <input
              value={cardTotal}
              onChange={(event) => setCardTotal(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <div className="cash-column-total">
            <span>Total cartao</span>
            <strong>{currencyFormatter.format(cardTotalValue)}</strong>
          </div>
        </div>

        <div className="cash-closing-column">
          <h2>Pix</h2>
          <label className="cash-money-input">
            Total em Pix
            <input
              value={pixTotal}
              onChange={(event) => setPixTotal(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <div className="cash-column-total">
            <span>Total Pix</span>
            <strong>{currencyFormatter.format(pixTotalValue)}</strong>
          </div>
        </div>
      </section>

      <section className="cash-closing-actions">
        <button onClick={saveClosing}>Fechar o dia</button>
        <button onClick={printClosing} className="cash-print-button">
          Imprimir / salvar PDF
        </button>
      </section>

      <section className="cash-closing-print">
        <div className="cash-print-header">
          <img src="/logo.jpeg" alt="Dr. Cafe" />
          <div>
            <h1>Fechamento de caixa</h1>
            <p>Dr. Cafe</p>
            <span>Data: {new Date(`${closingDate}T12:00:00`).toLocaleDateString('pt-BR')}</span>
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
            <span>Dinheiro contado</span>
            <strong>{currencyFormatter.format(countedCash)}</strong>
          </div>
          <div>
            <span>Cartao</span>
            <strong>{currencyFormatter.format(cardTotalValue)}</strong>
          </div>
          <div>
            <span>Pix</span>
            <strong>{currencyFormatter.format(pixTotalValue)}</strong>
          </div>
          <div>
            <span>Diferenca</span>
            <strong>{currencyFormatter.format(cashDifference)}</strong>
          </div>
          <div className="cash-print-total">
            <span>Total geral</span>
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
              <b>{currencyFormatter.format(openingCashValue)}</b>
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
        <h2>Ultimos fechamentos</h2>
        {closings.length === 0 ? (
          <p>Nenhum fechamento salvo ainda.</p>
        ) : (
          <div className="cash-history-grid">
            {closings.map((closing) => (
              <article key={closing.id} className="cash-history-card">
                <strong>{new Date(closing.closing_date).toLocaleDateString('pt-BR')}</strong>
                <span>Abertura: {closing.opening_cashier_name || '-'}</span>
                <span>Caixa: {closing.cashier_name}</span>
                <span>Dinheiro: {currencyFormatter.format(Number(closing.counted_cash))}</span>
                <span>Cartao: {currencyFormatter.format(Number(closing.card_total))}</span>
                <span>Pix: {currencyFormatter.format(Number(closing.pix_total))}</span>
                <b>Total: {currencyFormatter.format(Number(closing.grand_total))}</b>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
