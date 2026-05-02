const OFFLINE_SALES_KEY = 'dr-cafe-offline-sales'

export interface OfflineSale {
  id: string
  createdAt: string
  payload: Record<string, unknown>
  reason: string
}

export function readOfflineSales(): OfflineSale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function queueOfflineSale(payload: Record<string, unknown>, reason: string) {
  const sale: OfflineSale = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    payload,
    reason,
  }
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify([sale, ...readOfflineSales()]))
  return sale
}
