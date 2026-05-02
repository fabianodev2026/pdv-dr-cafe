export type AppLogLevel = 'error' | 'warn' | 'info'

export interface AppLogEntry {
  id: string
  timestamp: string
  level: AppLogLevel
  source: string
  action: string
  message: string
  details?: Record<string, unknown>
  url?: string
}

const STORAGE_KEY = 'dr-cafe-diagnostic-logs'
const MAX_LOGS = 120
const SENSITIVE_KEY_PATTERN = /password|senha|hash|cpf|phone|telefone|email/i

const safeString = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  return undefined
}

export function normalizeError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: safeString(error) ?? 'Erro desconhecido' }
  }

  const record = error as Record<string, unknown>

  return {
    message: safeString(record.message) ?? safeString(error) ?? 'Erro desconhecido',
    code: safeString(record.code),
    details: safeString(record.details),
    hint: safeString(record.hint),
    status: record.status,
    name: safeString(record.name),
  }
}

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeLogValue(entryValue),
    ]),
  )
}

function sanitizeLogDetails(details?: Record<string, unknown>) {
  return sanitizeLogValue(details) as Record<string, unknown> | undefined
}

export function readAppLogs(): AppLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearAppLogs() {
  localStorage.removeItem(STORAGE_KEY)
}

export function logAppEvent(entry: Omit<AppLogEntry, 'id' | 'timestamp' | 'url'>) {
  const nextEntry: AppLogEntry = {
    ...entry,
    details: sanitizeLogDetails(entry.details),
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  }

  try {
    const logs = [nextEntry, ...readAppLogs()].slice(0, MAX_LOGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch {
    // Keep the app usable even if localStorage is unavailable.
  }

  const consoleMethod = entry.level === 'error' ? console.error : console.warn
  consoleMethod(`[${entry.source}] ${entry.action}: ${entry.message}`, nextEntry.details)
}

export function logAppError({
  source,
  action,
  error,
  details,
}: {
  source: string
  action: string
  error: unknown
  details?: Record<string, unknown>
}) {
  const normalized = normalizeError(error)

  logAppEvent({
    level: 'error',
    source,
    action,
    message: normalized.message,
    details: {
      ...details,
      error: normalized,
    },
  })
}
