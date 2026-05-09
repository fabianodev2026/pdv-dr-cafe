export type NfceEnvironment = 'homologacao' | 'producao'

export interface NfceIssuerConfig {
  environment: NfceEnvironment
  cnpj: string
  stateInscription: string
  corporateName: string
  tradeName: string
  cityCodeIbge: string
  state: string
  certificateName: string
  certificateReady: boolean
  series: string
  nextNumber: string
}

export interface NfceItem {
  name: string
  quantity: number
  unit_price: number
  total: number
  ncm?: string
  cfop?: string
  cest?: string
  cst?: string
  aliquot?: string
}

export interface NfceDraft {
  saleId: string
  createdAt: string
  environment: NfceEnvironment
  customerCpf?: string
  totalAmount: number
  paymentMethod: string
  items: NfceItem[]
  status: 'aguardando_certificado' | 'pronta_para_backend' | 'autorizada' | 'erro'
}

const NFCE_CONFIG_KEY = 'dr-cafe-nfce-config'
const NFCE_QUEUE_KEY = 'dr-cafe-nfce-queue'

export const defaultNfceIssuerConfig: NfceIssuerConfig = {
  environment: 'homologacao',
  cnpj: '',
  stateInscription: '',
  corporateName: '',
  tradeName: 'Dr. Cafe',
  cityCodeIbge: '3530607',
  state: 'SP',
  certificateName: '',
  certificateReady: false,
  series: '1',
  nextNumber: '1',
}

export function readNfceIssuerConfig(): NfceIssuerConfig {
  try {
    const raw = localStorage.getItem(NFCE_CONFIG_KEY)
    return raw
      ? { ...defaultNfceIssuerConfig, ...JSON.parse(raw) }
      : defaultNfceIssuerConfig
  } catch {
    return defaultNfceIssuerConfig
  }
}

export function saveNfceIssuerConfig(config: NfceIssuerConfig) {
  localStorage.setItem(NFCE_CONFIG_KEY, JSON.stringify(config))
}

export function readNfceQueue(): NfceDraft[] {
  try {
    const raw = localStorage.getItem(NFCE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function queueNfceDraft(draft: NfceDraft) {
  localStorage.setItem(NFCE_QUEUE_KEY, JSON.stringify([draft, ...readNfceQueue()].slice(0, 200)))
}

export function removeNfceDraft(saleId: string) {
  localStorage.setItem(
    NFCE_QUEUE_KEY,
    JSON.stringify(readNfceQueue().filter((draft) => draft.saleId !== saleId)),
  )
}

export function createNfceDraft({
  customerCpf,
  totalAmount,
  paymentMethod,
  items,
}: {
  customerCpf?: string
  totalAmount: number
  paymentMethod: string
  items: NfceItem[]
}): NfceDraft {
  const config = readNfceIssuerConfig()

  return {
    saleId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    environment: config.environment,
    customerCpf: customerCpf || undefined,
    totalAmount,
    paymentMethod,
    items,
    status: config.certificateReady ? 'pronta_para_backend' : 'aguardando_certificado',
  }
}
