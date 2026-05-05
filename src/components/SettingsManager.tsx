import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  getBackupSchedule,
  getLastBackupSnapshot,
  readBackupState,
  runBackup,
  type BackupState,
} from '../lib/backupService'
import './SettingsManager.css'

type SettingsTab =
  | 'fiscal'
  | 'impressoras'
  | 'certificado'
  | 'balanco'
  | 'mais-vendidos'
  | 'backup'
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
  paperWidth: '80mm' | '58mm'
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
  const [backupState, setBackupState] = useState<BackupState>(() => readBackupState())
  const [backupRunning, setBackupRunning] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [message, setMessage] = useState('')
  const [fiscalData, setFiscalData] = useState<FiscalProductData>(initialFiscalData)
  const [printer, setPrinter] = useState<PrinterSettings>({
    connectionType: 'usb',
    ipAddress: '',
    paperWidth: '80mm',
    autoPrint: true,
  })
  const [certificate, setCertificate] = useState<CertificateSettings>({
    environment: 'homologacao',
    cnpj: '',
    stateInscription: '',
    certificateName: '',
    certificatePassword: '',
  })

  useEffect(() => {
    async function fetchData() {
      const [{ data: productsData }, { data: salesData }] = await Promise.all([
        supabase.from('products').select('id, name').order('name'),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
      ])

      setProducts(productsData ?? [])
      setSales(salesData ?? [])
    }

    fetchData()
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

        if (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        ) {
          totals.month += amount
        }

        if (saleDate.getFullYear() === now.getFullYear()) {
          totals.year += amount
        }

        return totals
      },
      { day: 0, month: 0, year: 0 },
    )
  }, [sales])

  const filteredSales = useMemo(() => {
    const now = new Date()

    return sales.filter((sale) => {
      const saleDate = new Date(sale.created_at)

      if (salesPeriod === 'todos') return true

      if (salesPeriod === 'dia') {
        return saleDate.toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')
      }

      if (salesPeriod === 'mes') {
        return (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        )
      }

      return saleDate.getFullYear() === now.getFullYear()
    })
  }, [sales, salesPeriod])

  const bestSellers = useMemo(() => {
    const ranking = new Map<string, BestSeller>()

    filteredSales.forEach((sale) => {
      ;(sale.items ?? []).forEach((item) => {
        const name = item.name?.trim()
        if (!name) return

        const quantity = Number(item.quantity || 1)
        const revenue = Number(
          item.total ?? Number(item.price ?? item.unit_price ?? 0) * quantity,
        )
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
  }, [filteredSales])

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

  const executeManualBackup = async () => {
    setBackupRunning(true)
    setMessage('Backup iniciado em segundo plano. O PDV continua liberado.')
    const result = await runBackup('Backup manual pelas configuracoes')
    setBackupRunning(false)
    setBackupState(readBackupState())
    setMessage(result.message || 'Backup finalizado.')
  }

  const schedule = getBackupSchedule()
  const lastSnapshot = getLastBackupSnapshot()

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
        <button className={activeTab === 'fiscal' ? 'active' : ''} onClick={() => setActiveTab('fiscal')}>
          Fiscal por produto
        </button>
        <button className={activeTab === 'impressoras' ? 'active' : ''} onClick={() => setActiveTab('impressoras')}>
          Impressoras
        </button>
        <button className={activeTab === 'certificado' ? 'active' : ''} onClick={() => setActiveTab('certificado')}>
          Certificado NFC-e
        </button>
        <button className={activeTab === 'balanco' ? 'active' : ''} onClick={() => setActiveTab('balanco')}>
          Balancos
        </button>
        <button className={activeTab === 'mais-vendidos' ? 'active' : ''} onClick={() => setActiveTab('mais-vendidos')}>
          Produtos mais vendidos
        </button>
        <button className={activeTab === 'backup' ? 'active' : ''} onClick={() => setActiveTab('backup')}>
          Backup automatico
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
              <input value={fiscalData.ncm} onChange={(e) => setFiscalData({ ...fiscalData, ncm: e.target.value })} />
            </label>
            <label>
              CEST
              <input value={fiscalData.cest} onChange={(e) => setFiscalData({ ...fiscalData, cest: e.target.value })} />
            </label>
            <label>
              CFOP
              <input value={fiscalData.cfop} onChange={(e) => setFiscalData({ ...fiscalData, cfop: e.target.value })} />
            </label>
            <label>
              CST/CSOSN
              <input value={fiscalData.cst} onChange={(e) => setFiscalData({ ...fiscalData, cst: e.target.value })} />
            </label>
            <label>
              Aliquota
              <input value={fiscalData.aliquot} onChange={(e) => setFiscalData({ ...fiscalData, aliquot: e.target.value })} />
            </label>
            <label>
              CNPJ fornecedor
              <input value={fiscalData.supplierCnpj} onChange={(e) => setFiscalData({ ...fiscalData, supplierCnpj: e.target.value })} />
            </label>
            <label>
              Numero da nota
              <input value={fiscalData.invoiceNumber} onChange={(e) => setFiscalData({ ...fiscalData, invoiceNumber: e.target.value })} />
            </label>
          </div>
          <button className="settings-save" onClick={saveDraft}>Salvar fiscal do produto</button>
        </section>
      )}

      {activeTab === 'impressoras' && (
        <section className="settings-panel">
          <h2>Impressoras</h2>
          <div className="settings-form">
            <label>
              Tipo de conexao
              <select
                value={printer.connectionType}
                onChange={(e) =>
                  setPrinter({ ...printer, connectionType: e.target.value as PrinterSettings['connectionType'] })
                }
              >
                <option value="usb">USB</option>
                <option value="network">Rede / Wi-Fi</option>
                <option value="bluetooth">Bluetooth</option>
              </select>
            </label>
            <label>
              IP da impressora
              <input value={printer.ipAddress} onChange={(e) => setPrinter({ ...printer, ipAddress: e.target.value })} />
            </label>
            <label>
              Bobina
              <select
                value={printer.paperWidth}
                onChange={(e) => setPrinter({ ...printer, paperWidth: e.target.value as PrinterSettings['paperWidth'] })}
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
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
          <button className="settings-save" onClick={saveDraft}>Salvar impressora</button>
        </section>
      )}

      {activeTab === 'certificado' && (
        <section className="settings-panel">
          <h2>Certificado digital NFC-e</h2>
          <div className="settings-form">
            <label>
              Ambiente
              <select
                value={certificate.environment}
                onChange={(e) =>
                  setCertificate({ ...certificate, environment: e.target.value as CertificateSettings['environment'] })
                }
              >
                <option value="homologacao">Homologacao</option>
                <option value="producao">Producao</option>
              </select>
            </label>
            <label>
              CNPJ
              <input value={certificate.cnpj} onChange={(e) => setCertificate({ ...certificate, cnpj: e.target.value })} />
            </label>
            <label>
              Inscricao estadual
              <input value={certificate.stateInscription} onChange={(e) => setCertificate({ ...certificate, stateInscription: e.target.value })} />
            </label>
            <label>
              Certificado A1
              <input type="file" accept=".pfx,.p12" onChange={(e) => setCertificate({ ...certificate, certificateName: e.target.files?.[0]?.name ?? '' })} />
            </label>
            <label>
              Senha do certificado
              <input type="password" value={certificate.certificatePassword} onChange={(e) => setCertificate({ ...certificate, certificatePassword: e.target.value })} />
            </label>
          </div>
          <p className="settings-note">
            A emissao NFC-e real precisa de um servico fiscal no backend para assinar e transmitir a nota.
          </p>
          <button className="settings-save" onClick={saveDraft}>Salvar certificado</button>
        </section>
      )}

      {activeTab === 'balanco' && (
        <section className="settings-panel">
          <h2>Balancos</h2>
          <div className="balance-grid">
            <article><span>Diario</span><strong>R$ {balance.day.toFixed(2)}</strong></article>
            <article><span>Mensal</span><strong>R$ {balance.month.toFixed(2)}</strong></article>
            <article><span>Anual</span><strong>R$ {balance.year.toFixed(2)}</strong></article>
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
            <label>
              Periodo
              <select
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value as SalesPeriod)}
              >
                <option value="dia">Hoje</option>
                <option value="mes">Mes atual</option>
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
              <div className="settings-empty">
                Nenhum produto vendido neste periodo.
              </div>
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
              <strong>
                {backupState.morningBackupPending ? 'pendente' : 'sem pendencia'}
              </strong>
            </p>
            {backupState.morningBackupReason && (
              <p>Motivo: {backupState.morningBackupReason}</p>
            )}
            {lastSnapshot && (
              <p>
                Ultimo pacote local: {Object.keys(lastSnapshot.tables).length} tabelas em{' '}
                {new Date(lastSnapshot.createdAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
