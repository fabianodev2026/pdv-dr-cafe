import { logAppError, logAppEvent } from './appLogger'
import {
  readOfflineSales,
  syncOfflineRecords as syncQueuedOfflineRecords,
  type OfflineSale,
} from './offlineQueue'
import { supabase } from './supabaseClient'

async function runOfflineRecord(sale: OfflineSale) {
  if (sale.operation === 'update') {
    return supabase
      .from(sale.targetTable)
      .update(sale.payload ?? {})
      .in('id', sale.recordIds ?? [])
  }

  if (sale.operation === 'delete') {
    return supabase.from(sale.targetTable).delete().in('id', sale.recordIds ?? [])
  }

  return supabase.from(sale.targetTable).insert([sale.payload ?? {}])
}

const AUTO_SYNC_INTERVAL_MS = 60 * 1000

let isSyncing = false

export async function syncOfflineQueue(reason = 'Sincronizacao manual') {
  if (isSyncing) {
    return {
      synced: 0,
      failed: 0,
      remaining: readOfflineSales().length,
      message: 'Sincronizacao offline ja esta em andamento.',
    }
  }

  const queuedBefore = readOfflineSales().length
  if (queuedBefore === 0) {
    return {
      synced: 0,
      failed: 0,
      remaining: 0,
      message: 'Nenhuma pendencia offline para subir.',
    }
  }

  isSyncing = true

  try {
    const result = await syncQueuedOfflineRecords(async (sale) => {
      const { error } = await runOfflineRecord(sale)
      return { error }
    })

    result.errors.forEach((entry) => {
      logAppError({
        source: 'offlineSyncService',
        action: 'syncOfflineQueue',
        error: entry.error,
        details: { offlineId: entry.id, targetTable: entry.targetTable, reason },
      })
    })

    logAppEvent({
      level: result.remaining === 0 ? 'info' : 'warn',
      source: 'offlineSyncService',
      action: 'syncOfflineQueue',
      message: 'Sincronizacao offline executada.',
      details: { reason, ...result },
    })

    return {
      ...result,
      message: `Offline: ${result.synced} sincronizado(s), ${result.failed} com erro, ${result.remaining} restante(s).`,
    }
  } finally {
    isSyncing = false
  }
}

export function startOfflineAutoSync() {
  const trySync = () => {
    if (!navigator.onLine || readOfflineSales().length === 0) return
    void syncOfflineQueue('Internet voltou ou verificacao automatica')
  }

  window.addEventListener('online', trySync)
  const intervalId = window.setInterval(trySync, AUTO_SYNC_INTERVAL_MS)
  trySync()

  return () => {
    window.removeEventListener('online', trySync)
    window.clearInterval(intervalId)
  }
}
