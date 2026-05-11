import { logAppError, logAppEvent } from './appLogger'
import { supabase } from './supabaseClient'

const BACKUP_STATE_KEY = 'dr-cafe-backup-state'
const BACKUP_SNAPSHOTS_KEY = 'dr-cafe-backup-snapshots'
const BACKUP_LOCK_KEY = 'dr-cafe-backup-lock'
const BACKUP_TIME = '20:00'
const OPEN_TIME = '07:30'
const TIME_ZONE = 'America/Sao_Paulo'
const MAX_LOCAL_SNAPSHOTS = 3
const LOCK_MINUTES = 10

const BACKUP_TABLES = [
  'products',
  'sales',
  'service_orders',
  'room_orders',
  'pending_payments',
  'app_customers',
  'app_orders',
  'daily_lunches',
  'cash_closings',
] as const

export interface BackupState {
  lastBackupAt?: string
  lastBackupDate?: string
  lastBackupReason?: string
  lastBackupStatus?: 'sucesso' | 'erro' | 'executando'
  lastBackupMessage?: string
  morningBackupPending?: boolean
  morningBackupReason?: string
  morningBackupMarkedAt?: string
}

interface BackupSnapshot {
  id: string
  createdAt: string
  localDate: string
  reason: string
  tables: Record<string, unknown[]>
}

function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`,
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeState(state: BackupState) {
  localStorage.setItem(BACKUP_STATE_KEY, JSON.stringify(state))
}

function readSnapshots(): BackupSnapshot[] {
  return readJson<BackupSnapshot[]>(BACKUP_SNAPSHOTS_KEY, [])
}

function writeSnapshots(snapshots: BackupSnapshot[]) {
  localStorage.setItem(
    BACKUP_SNAPSHOTS_KEY,
    JSON.stringify(snapshots.slice(0, MAX_LOCAL_SNAPSHOTS)),
  )
}

function isLocked() {
  const lock = readJson<{ startedAt?: string } | null>(BACKUP_LOCK_KEY, null)
  if (!lock?.startedAt) return false

  const startedAt = new Date(lock.startedAt).getTime()
  if (Number.isNaN(startedAt)) return false

  return Date.now() - startedAt < LOCK_MINUTES * 60 * 1000
}

function setLock() {
  localStorage.setItem(BACKUP_LOCK_KEY, JSON.stringify({ startedAt: new Date().toISOString() }))
}

function clearLock() {
  localStorage.removeItem(BACKUP_LOCK_KEY)
}

export function readBackupState(): BackupState {
  return readJson<BackupState>(BACKUP_STATE_KEY, {})
}

export function getBackupSchedule() {
  return {
    backupTime: BACKUP_TIME,
    openTime: OPEN_TIME,
    timeZone: TIME_ZONE,
  }
}

export function getLastBackupSnapshot() {
  return readSnapshots()[0]
}

export function markBackupNeededAfterClosing(reason: string) {
  const { time } = getLocalParts()
  if (time < BACKUP_TIME) return

  writeState({
    ...readBackupState(),
    morningBackupPending: true,
    morningBackupReason: reason,
    morningBackupMarkedAt: new Date().toISOString(),
  })
}

export async function runBackup(reason: string) {
  if (isLocked()) {
    return {
      ok: false,
      message: 'Backup ja esta em execucao em segundo plano.',
    }
  }

  const { date: localDate } = getLocalParts()
  setLock()
  writeState({
    ...readBackupState(),
    lastBackupStatus: 'executando',
    lastBackupReason: reason,
  })

  try {
    const tableEntries = await Promise.all(
      BACKUP_TABLES.map(async (table) => {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw new Error(`${table}: ${error.message}`)
        return [table, data ?? []] as const
      }),
    )
    const snapshot: BackupSnapshot = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      localDate,
      reason,
      tables: Object.fromEntries(tableEntries),
    }

    writeSnapshots([snapshot, ...readSnapshots()])

    const state: BackupState = {
      ...readBackupState(),
      lastBackupAt: snapshot.createdAt,
      lastBackupDate: localDate,
      lastBackupReason: reason,
      lastBackupStatus: 'sucesso',
      lastBackupMessage: 'Backup local concluido sem interromper o PDV.',
      morningBackupPending: false,
      morningBackupReason: undefined,
    }

    writeState(state)
    logAppEvent({
      level: 'info',
      source: 'backupService',
      action: 'runBackup',
      message: 'Backup automatico concluido.',
      details: { reason, localDate },
    })

    return { ok: true, message: state.lastBackupMessage }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida no backup.'
    writeState({
      ...readBackupState(),
      lastBackupStatus: 'erro',
      lastBackupMessage: message,
    })
    logAppError({
      source: 'backupService',
      action: 'runBackup',
      error,
      details: { reason },
    })

    return { ok: false, message }
  } finally {
    clearLock()
  }
}

export function shouldRunScheduledBackup() {
  const state = readBackupState()
  const { date, time } = getLocalParts()
  return time >= BACKUP_TIME && state.lastBackupDate !== date
}

export function shouldRunMorningBackup() {
  const state = readBackupState()
  const { time } = getLocalParts()
  return Boolean(state.morningBackupPending) && time >= OPEN_TIME
}

export function startBackupScheduler() {
  const tick = () => {
    if (shouldRunMorningBackup()) {
      void runBackup('Backup da manha por movimento apos as 20:00')
      return
    }

    if (shouldRunScheduledBackup()) {
      void runBackup('Backup automatico diario das 20:00')
    }
  }

  tick()
  return window.setInterval(tick, 60 * 1000)
}
