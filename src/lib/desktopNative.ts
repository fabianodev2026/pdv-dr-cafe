import { logAppError, logAppEvent } from './appLogger'

type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>

function getTauriInvoke(): TauriInvoke | null {
  return window.__TAURI__?.core?.invoke ?? null
}

export function isDesktopApp() {
  return Boolean(getTauriInvoke())
}

export async function invokeDesktopCommand<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  const invoke = getTauriInvoke()

  if (!invoke) {
    return { available: false as const }
  }

  try {
    const result = await invoke<T>(command, args)
    logAppEvent({
      level: 'info',
      source: 'desktopNative',
      action: command,
      message: 'Comando nativo executado.',
      details: args,
    })
    return { available: true as const, result }
  } catch (error) {
    logAppError({
      source: 'desktopNative',
      action: command,
      error,
      details: args,
    })
    return { available: true as const, error }
  }
}
