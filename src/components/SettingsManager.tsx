import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  getBackupSchedule,
  getLastBackupSnapshot,
  readBackupState,
  runBackup,
  type BackupState,
} from '../lib/backupService'
import {
  readReceiptPrinterSettings,
  saveReceiptPrinterSettings,
  type ReceiptPrinterSettings,
} from '../lib/printerSettings'
import {
  readNfceIssuerConfig,
  saveNfceIssuerConfig,
  type NfceIssuerConfig,
} from '../lib/nfceService'
import DiagnosticsManager from './DiagnosticsManager'
import QrCodePrintManager from './QrCodePrintManager'
import SupportAiManager from './SupportAiManager'
import './SettingsManager.css'

type SettingsTab =
  | 'fiscal'
  | 'impressoras'
  | 'certificado'
  | 'balanco'
  | 'mais-vendidos'
  | 'qrcodes'
  | 'backup'
  | 'atualizacao'
  | 'suporte'
type SalesPeriod = 'dia' | 'mes' | 'ano' | 'todos'

interface Product {
  id: number
  name: string
}

interface Sale {
  id: number
  created_at: string
  table_number: number
  cashier_name: string
  total_amount: number
  items?: SaleItem[]
}

interface PendingPayment {
  id: number
  created_at: string
  customer_name?: string
  phone?: string
  description?: string
  items_detail?: string
  total_amount: number
  purchase_date: string
  due_date?: string
  status?: string
}

interface SaleItem {
  name?: string
  quantity?: number
  total?: number
  price?: number
  unit_price?: number
}

interface BestSeller {
  name: string
  quantity: number
  revenue: number
  orders: number
}

const parseMoney = (value?: string) => Number(String(value ?? '0').replace(',', '.') || 0)
const CURRENT_APP_VERSION = '2.1.0'
const CURRENT_APP_DISPLAY_VERSION = '2.1'
const LATEST_INSTALLER_URL =
  'https://pdv-dr-cafe.vercel.app/atualizacao/INSTALADOR-PDV-DR-CAFE.exe'
const UPDATE_MANIFEST_URL = 'https://pdv-dr-cafe.vercel.app/atualizacao/manifest.json'
const LAST_UPDATE_STARTED_KEY = 'dr-cafe-last-update-started'

interface UpdateManifest {
  version: string
  displayVersion?: string
  releasedAt?: string
  installerUrl?: string
  notes?: string
}

const versionToNumber = (version: string) =>
  version
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
    .reduce((total, part, index) => total + part * Math.pow(1000, 2 - index), 0)

const isNewerVersion = (availableVersion?: string) =>
  availableVersion
    ? versionToNumber(availableVersion) > versionToNumber(CURRENT_APP_VERSION)
    : false

const formatUpdateDate = (date?: string) => {
  if (!date) return 'Nao informada'

  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const isSameReportMonth = (date: Date, monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number)
  return date.getFullYear() === year && date.getMonth() === month - 1
}

const formatReportDate = (date?: string) =>
  date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '-'

const parsePendingItems = (payment: PendingPayment): SaleItem[] => {
  const detail = payment.items_detail?.trim()
  if (!detail) {
    return [
      {
        name: payment.description || 'Pagar depois',
        quantity: 1,
        total: Number(payment.total_amount || 0),
      },
    ]
  }

  const parts = detail
    .split(/;|\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.map((part) => {
    const match = part.match(/^(\d+(?:[.,]\d+)?)x\s+(.+?)(?:\s+-\s+R\$\s*([\d.,]+))?$/i)
    if (!match) {
      return { name: part, quantity: 1, total: 0 }
    }

    return {
      quantity: parseMoney(match[1]),
      name: match[2].trim(),
      total: parseMoney(match[3]),
    }
  })
}

interface FiscalProductData {
  productId: string
  barcode: string
  ncm: string
  cest: string
  cfop: string
  cst: string
  aliquot: string
  supplierCnpj: string
  invoiceNumber: string
}

interface PrinterSettings {
  connectionType: 'usb' | 'network' | 'bluetooth'
  ipAddress: string
  receipt: ReceiptPrinterSettings
  autoPrint: boolean
}

interface CertificateSettings {
  environment: 'homologacao' | 'producao'
  cnpj: string
  stateInscription: string
  certificateName: string
  certificatePassword: string
}

const initialFiscalData: FiscalProductData = {
  productId: '',
  barcode: '',
  ncm: '',
  cest: '',
  cfop: '5102',
  cst: '102',
  aliquot: '',
  supplierCnpj: '',
  invoiceNumber: '',
}

export default function SettingsManager() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('fiscal')
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('mes')
  const [reportMonth, setReportMonth] = useState(getMonthInputValue())
  const [backupState, setBackupState] = useState<BackupState>(() => readBackupState())
  const [backupRunning, setBackupRunning] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [message, setMessage] = useState('')
  const [supportUnlocked, setSupportUnlocked] = useState(false)
  const [supportPassword, setSupportPassword] = useState('')
  const [updateManifest, setUpdateManifest] = useState<UpdateManifest | null>(null)
  const [updateCheckedAt, setUpdateCheckedAt] = useState('')
  const [lastUpdateStarted, setLastUpdateStarted] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [fiscalData, setFiscalData] = useState<FiscalProductData>(initialFiscalData)
  const [printer, setPrinter] = useState<PrinterSettings>({
    connectionType: 'usb',
    ipAddress: '',
    receipt: readReceiptPrinterSettings(),
    autoPrint: true,
  })
  const [certificate, setCertificate] = useState<CertificateSettings>({
    environment: 'homologacao',
    cnpj: '',
    stateInscription: '',
    certificateName: '',
    certificatePassword: '',
  })
  const [nfceConfig, setNfceConfig] = useState<NfceIssuerConfig>(() => readNfceIssuerConfig())

  useEffect(() => {
    async function fetchData() {
      const [{ data: productsData }, { data: salesData }, { data: pendingData }] = await Promise.all([
        supabase.from('products').select('id, name').order('name'),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase
          .from('pending_payments')
          .select(
            'id, created_at, customer_name, phone, description, items_detail, total_amount, purchase_date, due_date, status',
          )
          .order('created_at', { ascending: false }),
      ])

      setProducts(productsData ?? [])
      setSales(salesData ?? [])
      setPendingPayments(pendingData ?? [])
    }

    fetchData()
  }, [])

  useEffect(() => {
    setLastUpdateStarted(localStorage.getItem(LAST_UPDATE_STARTED_KEY) || '')

    async function fetchUpdateManifest() {
      setUpdateLoading(true)
      try {
        const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Nao foi possivel consultar o pacote online.')
        }

        const data = (await response.json()) as UpdateManifest
        setUpdateManifest(data)
        setUpdateCheckedAt(new Date().toISOString())
      } catch (error) {
        setUpdateManifest(null)
        setUpdateCheckedAt('')
      } finally {
        setUpdateLoading(false)
      }
    }

    fetchUpdateManifest()
  }, [])

  const balance = useMemo(() => {
    const now = new Date()
    const today = now.toLocaleDateString('pt-BR')

    return sales.reduce(
      (totals, sale) => {
        const saleDate = new Date(sale.created_at)
        const amount = sale.total_amount ?? 0

        if (saleDate.toLocaleDateString('pt-BR') === today) {
          totals.day += amount
        }

        if (isSameReportMonth(saleDate, reportMonth)) {
          totals.month += amount
        }

        if (saleDate.getFullYear() === now.getFullYear()) {
          totals.year += amount
        }

        return totals
      },
      { day: 0, month: 0, year: 0 },
    )
  }, [reportMonth, sales])

  const appPendingBalance = useMemo(() => {
    const now = new Date()
    const today = now.toLocaleDateString('pt-BR')

    return pendingPayments
      .filter((payment) => payment.description === 'Compra pelo app Dr. Cafe')
      .reduce(
        (totals, payment) => {
          const paymentDate = new Date(`${payment.purchase_date}T12:00:00`)
          const amount = Number(payment.total_amount || 0)

          if (paymentDate.toLocaleDateString('pt-BR') === today) {
            totals.day += amount
          }

          if (isSameReportMonth(paymentDate, reportMonth)) {
            totals.month += amount
          }

          if (paymentDate.getFullYear() === now.getFullYear()) {
            totals.year += amount
          }

          return totals
        },
        { day: 0, month: 0, year: 0 },
      )
  }, [pendingPayments, reportMonth])

  const payLaterBalance = useMemo(() => {
    const now = new Date()
    const today = now.toLocaleDateString('pt-BR')

    return pendingPayments.reduce(
      (totals, payment) => {
        const paymentDate = new Date(`${payment.purchase_date}T12:00:00`)
        const amount = Number(payment.total_amount || 0)

        if (paymentDate.toLocaleDateString('pt-BR') === today) {
          totals.day += amount
        }

        if (isSameReportMonth(paymentDate, reportMonth)) {
          totals.month += amount
        }

        if (paymentDate.getFullYear() === now.getFullYear()) {
          totals.year += amount
        }

        return totals
      },
      { day: 0, month: 0, year: 0 },
    )
  }, [pendingPayments, reportMonth])

  const movementBalance = useMemo(
    () => ({
      day: balance.day + appPendingBalance.day,
      month: balance.month + appPendingBalance.month,
      year: balance.year + appPendingBalance.year,
    }),
    [appPendingBalance, balance],
  )

  const filteredSales = useMemo(() => {
    const now = new Date()

    return sales.filter((sale) => {
      const saleDate = new Date(sale.created_at)

      if (salesPeriod === 'todos') return true

      if (salesPeriod === 'dia') {
        return saleDate.toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')
      }

      if (salesPeriod === 'mes') {
        return isSameReportMonth(saleDate, reportMonth)
      }

      return saleDate.getFullYear() === now.getFullYear()
    })
  }, [reportMonth, sales, salesPeriod])

  const filteredPendingPayments = useMemo(() => {
    const now = new Date()

    return pendingPayments.filter((payment) => {
      const paymentDate = new Date(`${payment.purchase_date}T12:00:00`)

      if (salesPeriod === 'todos') return true

      if (salesPeriod === 'dia') {
        return paymentDate.toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')
      }

      if (salesPeriod === 'mes') {
        return isSameReportMonth(paymentDate, reportMonth)
      }

      return paymentDate.getFullYear() === now.getFullYear()
    })
  }, [pendingPayments, reportMonth, salesPeriod])

  const todayPendingPayments = useMemo(() => {
    const today = new Date().toLocaleDateString('pt-BR')

    return pendingPayments.filter((payment) => {
      const paymentDate = new Date(`${payment.purchase_date}T12:00:00`)
      return paymentDate.toLocaleDateString('pt-BR') === today
    })
  }, [pendingPayments])

  const monthlyPendingPayments = useMemo(
    () =>
      pendingPayments.filter((payment) =>
        isSameReportMonth(new Date(`${payment.purchase_date}T12:00:00`), reportMonth),
      ),
    [pendingPayments, reportMonth],
  )

  const bestSellers = useMemo(() => {
    const ranking = new Map<string, BestSeller>()

    filteredSales.forEach((sale) => {
      ;(sale.items ?? []).forEach((item) => {
        const name = item.name?.trim()
        if (!name) return

        const quantity = Number(item.quantity || 1)
        const revenue = Number(item.total ?? Number(item.price ?? item.unit_price ?? 0) * quantity)
        const current = ranking.get(name) ?? {
          name,
          quantity: 0,
          revenue: 0,
          orders: 0,
        }

        ranking.set(name, {
          ...current,
          quantity: current.quantity + quantity,
          revenue: current.revenue + revenue,
          orders: current.orders + 1,
        })
      })
    })

    filteredPendingPayments.forEach((payment) => {
      parsePendingItems(payment).forEach((item) => {
        const name = item.name?.trim()
        if (!name) return

        const quantity = Number(item.quantity || 1)
        const revenue = Number(item.total ?? Number(item.price ?? item.unit_price ?? 0) * quantity)
        const current = ranking.get(name) ?? {
          name,
          quantity: 0,
          revenue: 0,
          orders: 0,
        }

        ranking.set(name, {
          ...current,
          quantity: current.quantity + quantity,
          revenue: current.revenue + revenue,
          orders: current.orders + 1,
        })
      })
    })

    return Array.from(ranking.values()).sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return b.revenue - a.revenue
    })
  }, [filteredPendingPayments, filteredSales])

  const readInvoiceKey = () => {
    const digits = fiscalData.barcode.replace(/\D/g, '')

    if (digits.length < 44) {
      setMessage('Informe uma chave de acesso da NF-e/NFC-e com 44 digitos.')
      return
    }

    const key = digits.slice(0, 44)
    setFiscalData({
      ...fiscalData,
      supplierCnpj: key.slice(6, 20),
      invoiceNumber: key.slice(25, 34),
    })
    setMessage('Dados basicos da nota preenchidos pela chave de acesso.')
  }

  const saveDraft = () => {
    setMessage('Configuracoes salvas como rascunho nesta tela.')
  }

  const savePrinterSettings = () => {
    saveReceiptPrinterSettings(printer.receipt)
    setMessage('Configuracoes da impressora salvas com sucesso.')
  }

  const saveNfceSettings = () => {
    saveNfceIssuerConfig(nfceConfig)
    setMessage('Configuracoes NFC-e salvas como preparacao. A emissao real fica separada ate ligar o certificado/backend.')
  }

  const executeManualBackup = async () => {
    setBackupRunning(true)
    setMessage('Backup iniciado em segundo plano. O PDV continua liberado.')
    const result = await runBackup('Backup manual pelas configuracoes')
    setBackupRunning(false)
    setBackupState(readBackupState())
    setMessage(result.message || 'Backup finalizado.')
  }

  const unlockSupport = async () => {
    if (!supportPassword.trim()) {
      setMessage('Informe a senha de suporte.')
      return
    }

    const { data, error } = await supabase.rpc('verify_pdv_support_access', {
      p_password: supportPassword,
    })

    if (error || data !== true) {
      setMessage(error?.message || 'Senha de suporte incorreta.')
      return
    }

    setSupportUnlocked(true)
    setSupportPassword('')
    setMessage('Suporte liberado com sucesso.')
  }

  const openSystemUpdater = () => {
    if (!navigator.onLine) {
      setMessage('Conecte a internet para baixar a atualizacao do sistema.')
      return
    }

    const nextVersion = updateManifest?.displayVersion || updateManifest?.version || 'mais nova'
    const startedAt = new Date().toISOString()
    localStorage.setItem(LAST_UPDATE_STARTED_KEY, startedAt)
    setLastUpdateStarted(startedAt)
    setMessage(
      `Abrindo atualizacao ${nextVersion}. Depois de baixar, feche o PDV e execute o instalador.`,
    )

    const installerUrl = updateManifest?.installerUrl || LATEST_INSTALLER_URL
    const opened = window.open(installerUrl, '_blank', 'noopener,noreferrer')
    if (!opened) {
      window.location.href = installerUrl
    }
  }

  const schedule = getBackupSchedule()
  const lastSnapshot = getLastBackupSnapshot()
  const availableVersion = updateManifest?.version || CURRENT_APP_VERSION
  const availableDisplayVersion =
    updateManifest?.displayVersion || updateManifest?.version || CURRENT_APP_DISPLAY_VERSION
  const hasUpdateAvailable = isNewerVersion(updateManifest?.version)
  const isCurrentPackageInstalled =
    !updateLoading && updateManifest?.version === CURRENT_APP_VERSION

  return (
    <div className="settings-manager">
      <header className="settings-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Configuracoes</h1>
          <p>Fiscal, impressoras, certificado digital e balancos.</p>
        </div>
      </header>
      {message && <div className="settings-alert">{message}</div>}
      <div className="settings-tabs">
        <button
          className={activeTab === 'fiscal' ? 'active' : ''}
          onClick={() => setActiveTab('fiscal')}
        >
          Fiscal por produto
        </button>
        <button
          className={activeTab === 'impressoras' ? 'active' : ''}
          onClick={() => setActiveTab('impressoras')}
        >
          Impressoras
        </button>
        <button
          className={activeTab === 'certificado' ? 'active' : ''}
          onClick={() => setActiveTab('certificado')}
        >
          Certificado NFC-e
        </button>
        <button
          className={activeTab === 'balanco' ? 'active' : ''}
          onClick={() => setActiveTab('balanco')}
        >
          Balancos
        </button>
        <button
          className={activeTab === 'mais-vendidos' ? 'active' : ''}
          onClick={() => setActiveTab('mais-vendidos')}
        >
          Produtos mais vendidos
        </button>
        <button
          className={activeTab === 'qrcodes' ? 'active' : ''}
          onClick={() => setActiveTab('qrcodes')}
        >
          QR Codes
        </button>
        <button
          className={activeTab === 'backup' ? 'active' : ''}
          onClick={() => setActiveTab('backup')}
        >
          Backup automatico
        </button>
        <button
          className={activeTab === 'atualizacao' ? 'active' : ''}
          onClick={() => setActiveTab('atualizacao')}
        >
          Atualizacao
        </button>
        <button
          className={activeTab === 'suporte' ? 'active' : ''}
          onClick={() => setActiveTab('suporte')}
        >
          Suporte
        </button>
      </div>
      {activeTab === 'fiscal' && (
        <section className="settings-panel">
          <h2>Dados fiscais do produto</h2>
          <div className="settings-form">
            <label>
              Produto
              <select
                value={fiscalData.productId}
                onChange={(e) => setFiscalData({ ...fiscalData, productId: e.target.value })}
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Codigo de barras / chave da nota de compra
              <div className="inline-field">
                <input
                  value={fiscalData.barcode}
                  onChange={(e) => setFiscalData({ ...fiscalData, barcode: e.target.value })}
                  placeholder="Cole ou leia a chave de acesso da nota"
                />
                <button onClick={readInvoiceKey}>Preencher</button>
              </div>
            </label>
            <label>
              NCM
              <input
                value={fiscalData.ncm}
                onChange={(e) => setFiscalData({ ...fiscalData, ncm: e.target.value })}
              />
            </label>
            <label>
              CEST
              <input
                value={fiscalData.cest}
                onChange={(e) => setFiscalData({ ...fiscalData, cest: e.target.value })}
              />
            </label>
            <label>
              CFOP
              <input
                value={fiscalData.cfop}
                onChange={(e) => setFiscalData({ ...fiscalData, cfop: e.target.value })}
              />
            </label>
            <label>
              CST/CSOSN
              <input
                value={fiscalData.cst}
                onChange={(e) => setFiscalData({ ...fiscalData, cst: e.target.value })}
              />
            </label>
            <label>
              Aliquota
              <input
                value={fiscalData.aliquot}
                onChange={(e) => setFiscalData({ ...fiscalData, aliquot: e.target.value })}
              />
            </label>
            <label>
              CNPJ fornecedor
              <input
                value={fiscalData.supplierCnpj}
                onChange={(e) => setFiscalData({ ...fiscalData, supplierCnpj: e.target.value })}
              />
            </label>
            <label>
              Numero da nota
              <input
                value={fiscalData.invoiceNumber}
                onChange={(e) => setFiscalData({ ...fiscalData, invoiceNumber: e.target.value })}
              />
            </label>
          </div>
          <button className="settings-save" onClick={saveDraft}>
            Salvar fiscal do produto
          </button>
        </section>
      )}
      {/* impressoras */}
      {activeTab === 'impressoras' && (
        <section className="settings-panel">
          <h2>Impressoras</h2>
          <div className="settings-form">
            <label>
              Tipo de conexao
              <select
                value={printer.connectionType}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    connectionType: e.target.value as PrinterSettings['connectionType'],
                  })
                }
              >
                <option value="usb">USB</option>
                <option value="network">Rede / Wi-Fi</option>
                <option value="bluetooth">Bluetooth</option>
              </select>
            </label>
            <label>
              IP da impressora
              <input
                value={printer.ipAddress}
                onChange={(e) => setPrinter({ ...printer, ipAddress: e.target.value })}
              />
            </label>
            <label>
              Bobina
              <select
                value={printer.receipt.paperWidth}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      paperWidth: e.target.value as ReceiptPrinterSettings['paperWidth'],
                    },
                  })
                }
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </label>
            <label>
              Altura da folha do cupom (mm)
              <input
                type="number"
                min="120"
                max="1000"
                step="10"
                value={printer.receipt.paperHeightMm}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      paperHeightMm: Number(e.target.value) || 300,
                    },
                  })
                }
              />
            </label>
            <label>
              Tamanho da fonte do cupom
              <input
                type="number"
                min="8"
                max="14"
                step="0.5"
                value={printer.receipt.fontSizePt}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      fontSizePt: Number(e.target.value) || 10,
                    },
                  })
                }
              />
            </label>
            <label>
              Espacamento entre linhas
              <input
                type="number"
                min="1"
                max="1.8"
                step="0.05"
                value={printer.receipt.lineHeight}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      lineHeight: Number(e.target.value) || 1.35,
                    },
                  })
                }
              />
            </label>
            <label>
              Avanco final do papel (mm)
              <input
                type="number"
                min="0"
                max="5"
                value={printer.receipt.bottomFeedMm}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      bottomFeedMm: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label>
              Tamanho do logo (mm)
              <input
                type="number"
                min="0"
                max="28"
                value={printer.receipt.logoSizeMm}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: {
                      ...printer.receipt,
                      logoSizeMm: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={printer.receipt.logoEnabled}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: { ...printer.receipt, logoEnabled: e.target.checked },
                  })
                }
              />
              Mostrar logo no cupom
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={printer.receipt.compactMode}
                onChange={(e) =>
                  setPrinter({
                    ...printer,
                    receipt: { ...printer.receipt, compactMode: e.target.checked },
                  })
                }
              />
              Modo compacto para evitar segunda folha
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={printer.autoPrint}
                onChange={(e) => setPrinter({ ...printer, autoPrint: e.target.checked })}
              />
              Imprimir automaticamente ao fechar comanda
            </label>
          </div>
          <p className="settings-note">
            No Edge/Chrome, desative cabecalhos e rodapes e use margens nenhuma ou minimas. Se o
            papel ficar preso na serrilha, aumente o avanco final.
          </p>
          <button className="settings-save" onClick={savePrinterSettings}>
            Salvar impressora
          </button>
        </section>
      )}
      {activeTab === 'certificado' && (
        <section className="settings-panel">
          <h2>Certificado digital NFC-e</h2>
          <div className="settings-form">
            <label>
              Ambiente
              <select
                value={nfceConfig.environment}
                onChange={(e) =>
                  setNfceConfig({
                    ...nfceConfig,
                    environment: e.target.value as NfceIssuerConfig['environment'],
                  })
                }
              >
                <option value="homologacao">Homologacao</option>
                <option value="producao">Producao</option>
              </select>
            </label>
            <label>
              CNPJ
              <input
                value={nfceConfig.cnpj}
                onChange={(e) => setNfceConfig({ ...nfceConfig, cnpj: e.target.value })}
              />
            </label>
            <label>
              Inscricao estadual
              <input
                value={nfceConfig.stateInscription}
                onChange={(e) =>
                  setNfceConfig({ ...nfceConfig, stateInscription: e.target.value })
                }
              />
            </label>
            <label>
              Razao social
              <input
                value={nfceConfig.corporateName}
                onChange={(e) =>
                  setNfceConfig({ ...nfceConfig, corporateName: e.target.value })
                }
              />
            </label>
            <label>
              Nome fantasia
              <input
                value={nfceConfig.tradeName}
                onChange={(e) => setNfceConfig({ ...nfceConfig, tradeName: e.target.value })}
              />
            </label>
            <label>
              Codigo IBGE do municipio
              <input
                value={nfceConfig.cityCodeIbge}
                onChange={(e) =>
                  setNfceConfig({ ...nfceConfig, cityCodeIbge: e.target.value })
                }
              />
            </label>
            <label>
              UF
              <input
                value={nfceConfig.state}
                onChange={(e) => setNfceConfig({ ...nfceConfig, state: e.target.value.toUpperCase() })}
                maxLength={2}
              />
            </label>
            <label>
              Serie NFC-e
              <input
                value={nfceConfig.series}
                onChange={(e) => setNfceConfig({ ...nfceConfig, series: e.target.value })}
              />
            </label>
            <label>
              Proximo numero NFC-e
              <input
                value={nfceConfig.nextNumber}
                onChange={(e) => setNfceConfig({ ...nfceConfig, nextNumber: e.target.value })}
              />
            </label>
            <label>
              Certificado A1
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) =>
                  setNfceConfig({
                    ...nfceConfig,
                    certificateName: e.target.files?.[0]?.name ?? '',
                    certificateReady: Boolean(e.target.files?.[0]),
                  })
                }
              />
            </label>
            {nfceConfig.certificateName && (
              <label>
                Certificado selecionado
                <input value={nfceConfig.certificateName} readOnly />
              </label>
            )}
            <label>
              Senha do certificado
              <input
                type="password"
                value={certificate.certificatePassword}
                onChange={(e) =>
                  setCertificate({ ...certificate, certificatePassword: e.target.value })
                }
              />
            </label>
          </div>
          <p className="settings-note">
            Pre-preparacao NFC-e separada do cupom nao fiscal. O arquivo e a senha do certificado
            nao sao enviados daqui; a emissao real precisa de backend fiscal para assinar XML,
            transmitir para SEFAZ-SP e devolver protocolo, XML autorizado e QR Code oficial.
          </p>
          <button className="settings-save" onClick={saveNfceSettings}>
            Salvar configuracoes NFC-e
          </button>
        </section>
      )}
      {activeTab === 'balanco' && (
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Balancos</h2>
              <p>Consulte o mes atual ou um mes ja fechado sem perder o historico.</p>
            </div>
            <label>
              Mes do relatorio
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value || getMonthInputValue())}
              />
            </label>
          </div>
          <div className="balance-grid">
            <article>
              <span>Diario</span>
              <strong>R$ {movementBalance.day.toFixed(2)}</strong>
            </article>
            <article>
              <span>Mes selecionado</span>
              <strong>R$ {movementBalance.month.toFixed(2)}</strong>
            </article>
            <article>
              <span>Anual</span>
              <strong>R$ {movementBalance.year.toFixed(2)}</strong>
            </article>
          </div>
          <div className="pay-later-report">
            <div className="settings-section-title">
              <h3>Pagar depois</h3>
              <p>Controle do que foi marcado para receber depois.</p>
            </div>
            <div className="balance-grid">
              <article>
                <span>Pagar depois diario</span>
                <strong>R$ {payLaterBalance.day.toFixed(2)}</strong>
              </article>
              <article>
                <span>Pagar depois do mes</span>
                <strong>R$ {payLaterBalance.month.toFixed(2)}</strong>
              </article>
              <article>
                <span>Pagar depois anual</span>
                <strong>R$ {payLaterBalance.year.toFixed(2)}</strong>
              </article>
            </div>
            <div className="pay-later-report-grid">
              <div className="history-section">
                <h3>Pagar depois de hoje</h3>
                {todayPendingPayments.length === 0 ? (
                  <div className="settings-empty">Nenhum pagar depois lancado hoje.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Consumiu</th>
                        <th>Status</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayPendingPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.customer_name || '-'}</td>
                          <td>{payment.items_detail || payment.description || '-'}</td>
                          <td>{payment.status || 'pendente'}</td>
                          <td>R$ {Number(payment.total_amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="history-section">
                <h3>Pagar depois do mes selecionado</h3>
                {monthlyPendingPayments.length === 0 ? (
                  <div className="settings-empty">Nenhum pagar depois neste mes.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Compra</th>
                        <th>Cliente</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyPendingPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatReportDate(payment.purchase_date)}</td>
                          <td>{payment.customer_name || '-'}</td>
                          <td>{formatReportDate(payment.due_date)}</td>
                          <td>R$ {Number(payment.total_amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <div className="history-section">
            <h3>Ultimas vendas</h3>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Mesa/Quarto</th>
                  <th>Caixa</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.created_at).toLocaleString('pt-BR')}</td>
                    <td>{sale.table_number}</td>
                    <td>{sale.cashier_name}</td>
                    <td>R$ {sale.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {activeTab === 'mais-vendidos' && (
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Produtos mais vendidos</h2>
              <p>Ranking calculado pelas vendas registradas no PDV.</p>
            </div>
            {salesPeriod === 'mes' && (
              <label>
                Mes do relatorio
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value || getMonthInputValue())}
                />
              </label>
            )}
            <label>
              Periodo
              <select
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value as SalesPeriod)}
              >
                <option value="dia">Hoje</option>
                <option value="mes">Mes selecionado</option>
                <option value="ano">Ano atual</option>
                <option value="todos">Todos</option>
              </select>
            </label>
          </div>

          <div className="best-seller-summary">
            <article>
              <span>Vendas analisadas</span>
              <strong>{filteredSales.length}</strong>
            </article>
            <article>
              <span>Produtos vendidos</span>
              <strong>{bestSellers.length}</strong>
            </article>
            <article>
              <span>Top produto</span>
              <strong>{bestSellers[0]?.name ?? '-'}</strong>
            </article>
          </div>

          <div className="history-section">
            {bestSellers.length === 0 ? (
              <div className="settings-empty">Nenhum produto vendido neste periodo.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Posicao</th>
                    <th>Produto</th>
                    <th>Quantidade</th>
                    <th>Vendas</th>
                    <th>Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellers.map((item, index) => (
                    <tr key={item.name}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.orders}</td>
                      <td>R$ {item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
      {activeTab === 'qrcodes' && (
        <section className="settings-panel settings-panel--print">
          <QrCodePrintManager />
        </section>
      )}
      {activeTab === 'backup' && (
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Backup automatico</h2>
              <p>Rotina diaria sem interromper o atendimento do caixa.</p>
            </div>
            <button
              className="settings-save"
              onClick={executeManualBackup}
              disabled={backupRunning}
            >
              {backupRunning ? 'Backup em andamento' : 'Executar agora'}
            </button>
          </div>

          <div className="backup-grid">
            <article>
              <span>Horario diario</span>
              <strong>{schedule.backupTime}</strong>
              <small>Mogi das Cruzes, SP ({schedule.timeZone})</small>
            </article>
            <article>
              <span>Abertura</span>
              <strong>{schedule.openTime}</strong>
              <small>Se houver movimento apos 20:00, refaz pela manha.</small>
            </article>
            <article>
              <span>Status</span>
              <strong>{backupState.lastBackupStatus ?? 'aguardando'}</strong>
              <small>{backupState.lastBackupMessage ?? 'Nenhum backup registrado ainda.'}</small>
            </article>
          </div>

          <div className="backup-status">
            <p>
              Ultimo backup:{' '}
              <strong>
                {backupState.lastBackupAt
                  ? new Date(backupState.lastBackupAt).toLocaleString('pt-BR')
                  : 'nenhum'}
              </strong>
            </p>
            <p>
              Backup da manha:{' '}
              <strong>{backupState.morningBackupPending ? 'pendente' : 'sem pendencia'}</strong>
            </p>
            {backupState.morningBackupReason && <p>Motivo: {backupState.morningBackupReason}</p>}
            {lastSnapshot && (
              <p>
                Ultimo pacote local: {Object.keys(lastSnapshot.tables).length} tabelas em{' '}
                {new Date(lastSnapshot.createdAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </section>
      )}
      {activeTab === 'atualizacao' && (
        <section className="settings-panel update-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Atualizacao do sistema</h2>
              <p>Confira a versao instalada e baixe somente quando existir pacote novo.</p>
            </div>
            {hasUpdateAvailable && (
              <button className="settings-save" onClick={openSystemUpdater}>
                Atualizar sistema
              </button>
            )}
          </div>

          <div className="update-box">
            {isCurrentPackageInstalled && (
              <div className="update-success-card" role="status" aria-live="polite">
                <span className="update-success-icon">OK</span>
                <div>
                  <strong>Atualizacao feita com sucesso.</strong>
                  <p>
                    O PDV esta na versao {CURRENT_APP_DISPLAY_VERSION} e nao ha
                    pacote pendente para instalar.
                  </p>
                </div>
              </div>
            )}
            <div className="update-version-grid">
              <div>
                <span>Versao instalada</span>
                <strong>{CURRENT_APP_DISPLAY_VERSION}</strong>
              </div>
              <div>
                <span>Versao disponivel</span>
                <strong>{availableDisplayVersion}</strong>
              </div>
              <div>
                <span>Data da atualizacao</span>
                <strong>{formatUpdateDate(updateManifest?.releasedAt)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  {updateLoading
                    ? 'Verificando...'
                    : hasUpdateAvailable
                      ? 'Atualizacao disponivel'
                      : isCurrentPackageInstalled
                        ? 'Sistema atualizado'
                        : 'Nao foi possivel conferir online'}
                </strong>
              </div>
            </div>
            {isCurrentPackageInstalled ? (
              <p>
                Este computador ja esta na versao {CURRENT_APP_DISPLAY_VERSION}. O pacote
                instalado nao aparece como pendente de novo.
              </p>
            ) : hasUpdateAvailable ? (
              <p>
                Existe um pacote novo ({availableVersion}). Clique em Atualizar sistema,
                feche o PDV e execute o instalador baixado.
              </p>
            ) : (
              <p>
                Sem internet ou sem resposta do servidor agora. Quando conectar, o PDV
                confere automaticamente a versao publicada.
              </p>
            )}
            {updateManifest?.notes && <small>Pacote: {updateManifest.notes}</small>}
            {lastUpdateStarted && (
              <small>
                Ultima atualizacao iniciada neste computador:{' '}
                {formatUpdateDate(lastUpdateStarted)}
              </small>
            )}
            {updateCheckedAt && (
              <small>Ultima conferencia online: {formatUpdateDate(updateCheckedAt)}</small>
            )}
            <p>
              Apos instalar a versao nova, abra o PDV novamente. Se a versao instalada
              for igual a disponivel, o botao de atualizar fica oculto.
            </p>
            <small>
              Antes de atualizar, feche o PDV no computador do cafe e confira se
              nao ficou venda offline pendente.
            </small>
          </div>
        </section>
      )}
      {activeTab === 'suporte' && (
        <section className="settings-panel settings-support-panel">
          <h2>Suporte</h2>
          {!supportUnlocked ? (
            <div className="settings-form">
              <label>
                Senha de acesso ao suporte
                <input
                  type="password"
                  value={supportPassword}
                  onChange={(event) => setSupportPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      unlockSupport()
                    }
                  }}
                />
              </label>
              <button className="settings-save" onClick={unlockSupport}>
                Acessar suporte
              </button>
              <p className="settings-note">
                Esta area concentra diagnostico, ultimos erros, fila offline, fila fiscal e
                manutencao tecnica.
              </p>
            </div>
          ) : (
            <div className="support-tools-stack">
              <DiagnosticsManager />
              <SupportAiManager />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
