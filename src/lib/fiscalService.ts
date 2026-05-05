import type { AppLogEntry } from './appLogger'

export interface FiscalItem {
  name: string
  quantity: number
  unit_price: number
  total: number
}

export interface FiscalPayload {
  saleId: string
  createdAt: string
  customerCpf?: string
  totalAmount: number
  paymentMethod: string
  items: FiscalItem[]
  status: 'pendente_certificado' | 'pronto_para_envio' | 'emitida' | 'erro'
}

export interface AiSupportDraft {
  id: string
  createdAt: string
  status: 'aguardando_suporte_tecnico'
  title: string
  summary: string
  logs: AppLogEntry[]
}

const FISCAL_QUEUE_KEY = 'dr-cafe-fiscal-queue'
const FISCAL_RETENTION_DAYS = 30

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function isCompleteCpf(value: string) {
  return value.replace(/\D/g, '').length === 11
}

function persistFiscalQueue(queue: FiscalPayload[]) {
  localStorage.setItem(FISCAL_QUEUE_KEY, JSON.stringify(queue))
}

function isWithinFiscalRetention(payload: FiscalPayload) {
  const createdAt = new Date(payload.createdAt).getTime()
  if (Number.isNaN(createdAt)) return false

  const maxAge = FISCAL_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - createdAt <= maxAge
}

export function readFiscalQueue(): FiscalPayload[] {
  try {
    const raw = localStorage.getItem(FISCAL_QUEUE_KEY)
    const queue = raw ? (JSON.parse(raw) as FiscalPayload[]) : []
    const retained = queue.filter(isWithinFiscalRetention)

    if (retained.length !== queue.length) {
      persistFiscalQueue(retained)
    }

    return retained
  } catch {
    return []
  }
}

export function queueFiscalPayload(payload: FiscalPayload) {
  const queue = [payload, ...readFiscalQueue()].slice(0, 200)
  persistFiscalQueue(queue)
}

export function removeFiscalPayload(saleId: string) {
  persistFiscalQueue(readFiscalQueue().filter((payload) => payload.saleId !== saleId))
}

export function getFiscalRetentionDays() {
  return FISCAL_RETENTION_DAYS
}

export function createFiscalPayload({
  customerCpf,
  totalAmount,
  paymentMethod,
  items,
}: {
  customerCpf?: string
  totalAmount: number
  paymentMethod: string
  items: FiscalItem[]
}): FiscalPayload {
  return {
    saleId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    customerCpf: customerCpf || undefined,
    totalAmount,
    paymentMethod,
    items,
    status: 'pendente_certificado',
  }
}

export function createAiSupportDraft(logs: AppLogEntry[]): AiSupportDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    status: 'aguardando_suporte_tecnico',
    title: 'Analise de falha solicitada pelo PDV',
    summary:
      'Registro criado localmente. A conexao com IA/backend de correcao ainda precisa ser configurada.',
    logs: logs.slice(0, 20),
  }
}
