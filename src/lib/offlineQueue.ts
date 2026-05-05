const OFFLINE_SALES_KEY = 'dr-cafe-offline-sales'
const OFFLINE_RETENTION_DAYS = 7

export type OfflineTargetTable = 'sales' | 'pending_payments'

export interface OfflineSale {
  id: string
  createdAt: string
  targetTable: OfflineTargetTable
  payload: Record<string, unknown>
  reason: string
}

function persistOfflineSales(sales: OfflineSale[]) {
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(sales))
}

function isWithinRetention(sale: OfflineSale) {
  const createdAt = new Date(sale.createdAt).getTime()
  if (Number.isNaN(createdAt)) return false

  const maxAge = OFFLINE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - createdAt <= maxAge
}

export function readOfflineSales(): OfflineSale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<OfflineSale>[]) : []
    const normalized = parsed.map((sale) => ({
      ...sale,
      targetTable: sale.targetTable ?? 'sales',
    })) as OfflineSale[]
    const retained = normalized.filter(isWithinRetention)

    if (retained.length !== normalized.length) {
      persistOfflineSales(retained)
    }

    return retained
  } catch {
    return []
  }
}

export function queueOfflineRecord(
  targetTable: OfflineTargetTable,
  payload: Record<string, unknown>,
  reason: string,
) {
  const sale: OfflineSale = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    targetTable,
    payload,
    reason,
  }
  persistOfflineSales([sale, ...readOfflineSales()])
  return sale
}

export function queueOfflineSale(payload: Record<string, unknown>, reason: string) {
  return queueOfflineRecord('sales', payload, reason)
}

export function removeOfflineSale(id: string) {
  persistOfflineSales(readOfflineSales().filter((sale) => sale.id !== id))
}

export function getOfflineRetentionDays() {
  return OFFLINE_RETENTION_DAYS
}
