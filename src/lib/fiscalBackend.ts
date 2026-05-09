import type { FiscalPayload } from './fiscalService'
import type { NfceDraft } from './nfceService'

interface FiscalBackendResult {
  status: 'emitida' | 'autorizada' | 'erro' | 'pendente'
  protocol?: string
  qrCodeUrl?: string
  qrCodeText?: string
  issuedAt?: string
  message?: string
}

const fiscalApiUrl = import.meta.env.VITE_FISCAL_API_URL?.replace(/\/$/, '')

export function isFiscalBackendConfigured() {
  return Boolean(fiscalApiUrl)
}

export async function submitFiscalToBackend(
  payload: FiscalPayload,
): Promise<FiscalBackendResult> {
  if (!fiscalApiUrl) {
    throw new Error('Backend fiscal nao configurado.')
  }

  const response = await fetch(`${fiscalApiUrl}/fiscal/nfp/emitir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      saleId: payload.saleId,
      customerCpf: payload.customerCpf,
      totalAmount: payload.totalAmount,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
    }),
  })

  const result = (await response.json().catch(() => ({}))) as FiscalBackendResult

  if (!response.ok) {
    throw new Error(result.message || 'Falha ao comunicar com backend fiscal.')
  }

  return result
}

export async function submitNfceToBackend(
  payload: NfceDraft,
): Promise<FiscalBackendResult> {
  if (!fiscalApiUrl) {
    throw new Error('Backend fiscal NFC-e nao configurado.')
  }

  const response = await fetch(`${fiscalApiUrl}/fiscal/nfce/emitir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = (await response.json().catch(() => ({}))) as FiscalBackendResult

  if (!response.ok) {
    throw new Error(result.message || 'Falha ao comunicar com backend NFC-e.')
  }

  return result
}
