export interface ReceiptPrinterSettings {
  paperWidth: '80mm' | '58mm'
  paperHeightMm: number
  fontSizePt: number
  lineHeight: number
  bottomFeedMm: number
  logoEnabled: boolean
  logoSizeMm: number
  compactMode: boolean
  showBrowserPrintTip: boolean
}

const PRINTER_SETTINGS_KEY = 'dr-cafe-printer-settings-v2'

export const defaultReceiptPrinterSettings: ReceiptPrinterSettings = {
  paperWidth: '80mm',
  paperHeightMm: 120,
  fontSizePt: 10,
  lineHeight: 1.35,
  bottomFeedMm: 18,
  logoEnabled: true,
  logoSizeMm: 14,
  compactMode: false,
  showBrowserPrintTip: true,
}

export function readReceiptPrinterSettings(): ReceiptPrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_SETTINGS_KEY)
    return raw
      ? { ...defaultReceiptPrinterSettings, ...JSON.parse(raw) }
      : defaultReceiptPrinterSettings
  } catch {
    return defaultReceiptPrinterSettings
  }
}

export function saveReceiptPrinterSettings(settings: ReceiptPrinterSettings) {
  localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(settings))
}
