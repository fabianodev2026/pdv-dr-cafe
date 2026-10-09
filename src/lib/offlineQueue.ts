const OFFLINE_SALES_KEY = 'dr-cafe-offline-sales'
const OFFLINE_RETENTION_DAYS = 7

export type OfflineTargetTable = 'sales' | 'pending_payments' | 'products' | 'pdv_customers' | 'room_orders' | 'service_orders' | 'app_orders'
export type OfflineOperation = 'insert' | 'update' | 'delete'

export interface OfflineSale {
  id: string
  createdAt: string
  targetTable: OfflineTargetTable
  operation: OfflineOperation
  payload?: Record<string, unknown>
  recordIds?: Array<number | string>
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
      operation: sale.operation ?? 'insert',
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

function queueOffline(sale: Omit<OfflineSale, 'id' | 'createdAt'>) {
  const record: OfflineSale = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...sale,
  }
  // Mantem ordem cronologica (mais antigo primeiro) para que edicoes e
  // exclusoes offline do mesmo registro sejam replicadas na ordem certa.
  persistOfflineSales([...readOfflineSales(), record])
  return record
}

export function queueOfflineRecord(
  targetTable: OfflineTargetTable,
  payload: Record<string, unknown>,
  reason: string,
) {
  return queueOffline({ targetTable, operation: 'insert', payload, reason })
}

export function queueOfflineSale(payload: Record<string, unknown>, reason: string) {
  return queueOfflineRecord('sales', payload, reason)
}

export function queueOfflineUpdate(
  targetTable: OfflineTargetTable,
  recordIds: Array<number | string>,
  payload: Record<string, unknown>,
  reason: string,
) {
  return queueOffline({ targetTable, operation: 'update', payload, recordIds, reason })
}

export function queueOfflineDelete(
  targetTable: OfflineTargetTable,
  recordIds: Array<number | string>,
  reason: string,
) {
  return queueOffline({ targetTable, operation: 'delete', recordIds, reason })
}

export function removeOfflineSale(id: string) {
  persistOfflineSales(readOfflineSales().filter((sale) => sale.id !== id))
}

export async function syncOfflineRecords(
  runRecord: (sale: OfflineSale) => Promise<{ error?: unknown }>,
) {
  const queuedSales = readOfflineSales()
  let synced = 0
  let failed = 0
  const errors: Array<{ id: string; targetTable: OfflineTargetTable; error: unknown }> = []

  for (const sale of queuedSales) {
    const { error } = await runRecord(sale)

    if (error) {
      failed += 1
      errors.push({
        id: sale.id,
        targetTable: sale.targetTable,
        error,
      })
    } else {
      synced += 1
      removeOfflineSale(sale.id)
    }
  }

  return {
    synced,
    failed,
    errors,
    remaining: readOfflineSales().length,
  }
}

export function getOfflineRetentionDays() {
  return OFFLINE_RETENTION_DAYS
}
