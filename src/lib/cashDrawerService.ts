import { logAppError, logAppEvent } from './appLogger'
import { invokeDesktopCommand } from './desktopNative'

const CASH_DRAWER_URL =
  import.meta.env.VITE_CASH_DRAWER_URL || 'http://127.0.0.1:8787/cash-drawer/open'

export const CASH_DRAWER_INFO = {
  brand: 'Brasil PC',
  serialNumber: '715sz25081460',
}

export async function openCashDrawer(paymentMethod: string) {
  const desktopResult = await invokeDesktopCommand('open_cash_drawer', {
    paymentMethod,
    brand: CASH_DRAWER_INFO.brand,
    serialNumber: CASH_DRAWER_INFO.serialNumber,
  })

  if (desktopResult.available && !desktopResult.error) {
    return
  }

  try {
    await fetch(CASH_DRAWER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand: CASH_DRAWER_INFO.brand,
        serialNumber: CASH_DRAWER_INFO.serialNumber,
        paymentMethod,
        openedAt: new Date().toISOString(),
      }),
    })

    logAppEvent({
      level: 'info',
      source: 'cashDrawerService',
      action: 'openCashDrawer',
      message: 'Comando de abertura da gaveta enviado.',
      details: {
        brand: CASH_DRAWER_INFO.brand,
        serialNumber: CASH_DRAWER_INFO.serialNumber,
        paymentMethod,
      },
    })
  } catch (error) {
    logAppError({
      source: 'cashDrawerService',
      action: 'openCashDrawer',
      error,
      details: {
        brand: CASH_DRAWER_INFO.brand,
        serialNumber: CASH_DRAWER_INFO.serialNumber,
        paymentMethod,
      },
    })
  }
}
