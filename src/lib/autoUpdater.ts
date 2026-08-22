import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { logAppError, logAppEvent } from './appLogger'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const LAST_CHECK_KEY = 'dr-cafe-updater-last-check'
let running = false

function isDesktop() {
  return Boolean(window.__TAURI__?.core?.invoke)
}

async function checkAndInstallUpdate(source: 'startup' | 'online' | 'scheduled') {
  if (running || !navigator.onLine || !isDesktop()) return false

  running = true
  try {
    const update = await check()
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())

    if (!update) return false

    logAppEvent({
      level: 'info',
      source: 'autoUpdater',
      action: 'update-found',
      message: `Atualizacao ${update.version} encontrada.`,
      details: { source },
    })

    await update.downloadAndInstall()

    logAppEvent({
      level: 'info',
      source: 'autoUpdater',
      action: 'update-installed',
      message: `Atualizacao ${update.version} instalada.`,
    })

    await relaunch()
    return true
  } catch (error) {
    logAppError({
      source: 'autoUpdater',
      action: 'check-or-install',
      error,
      details: { source },
    })
    return false
  } finally {
    running = false
  }
}

export function startAutomaticUpdater() {
  if (!isDesktop()) return () => undefined

  const onOnline = () => {
    void checkAndInstallUpdate('online')
  }

  window.addEventListener('online', onOnline)

  const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
  const elapsed = lastCheck ? Date.now() - new Date(lastCheck).getTime() : Infinity
  if (navigator.onLine && elapsed >= CHECK_INTERVAL_MS) {
    window.setTimeout(() => void checkAndInstallUpdate('startup'), 5000)
  }

  const intervalId = window.setInterval(() => {
    void checkAndInstallUpdate('scheduled')
  }, CHECK_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(intervalId)
  }
}

export async function checkForUpdateNow() {
  return checkAndInstallUpdate('startup')
}
