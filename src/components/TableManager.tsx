import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createFiscalPayload, formatCpf, isCompleteCpf, queueFiscalPayload } from '../lib/fiscalService'
import { logAppError } from '../lib/appLogger'
import { queueOfflineRecord, queueOfflineSale } from '../lib/offlineQueue'
import { markBackupNeededAfterClosing } from '../lib/backupService'
import { openCashDrawer } from '../lib/cashDrawerService'
import { readReceiptPrinterSettings, type ReceiptPrinterSettings } from '../lib/printerSettings'
import './TableManager.css'

interface Product {
  id: number
  name: string
  unit_price: number
  image_url?: string
  description?: string
  category?: string
  stock_quantity?: number
  low_stock_threshold?: number
}

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  total: number
}

interface TableItem {
  id: number
  number: number
  type: 'table' | 'room'
  status: 'Livre' | 'Ocupada'
  total: number
  items: OrderItem[]
  customer_name: string
  customer_phone: string
}

interface ReceiptData {
  type: 'table' | 'room'
  number: number
  items: OrderItem[]
  total: number
  customer_name: string
  customer_phone: string
  date: string
  payment_method: PaymentMethod
  fiscal_cpf: string
  fiscal_qr_text: string
}

type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'pagar_depois'

interface CurrentUser {
  username: string
  role: string
}

interface TableManagerProps {
  currentUser?: CurrentUser
}

const LAST_RECEIPT_KEY = 'dr-cafe-last-receipt'

const createServiceItem = (number: number, type: 'table' | 'room'): TableItem => ({
  id: type === 'table' ? number : 1000 + number,
  number,
  type,
  status: 'Livre',
  total: 0,
  items: [],
  customer_name: '',
  customer_phone: '',
})

const initialTables: TableItem[] = Array.from({ length: 6 }, (_, index) =>
  createServiceItem(index + 1, 'table'),
)

const roomNumbers = [
  ...Array.from({ length: 7 }, (_, index) => 101 + index),
  ...Array.from({ length: 11 }, (_, index) => 201 + index),
  ...Array.from({ length: 15 }, (_, index) => 301 + index),
]

const initialRooms: TableItem[] = roomNumbers.map((number) =>
  createServiceItem(number, 'room'),
)

const createFiscalQrText = (receipt: Omit<ReceiptData, 'fiscal_qr_text'>) => {
  if (!receipt.fiscal_cpf || !isCompleteCpf(receipt.fiscal_cpf)) return ''

  return [
    'DR CAFE',
    'NOTA FISCAL PAULISTA',
    `CPF=${receipt.fiscal_cpf}`,
    `TOTAL=${receipt.total.toFixed(2)}`,
    `PAGAMENTO=${receipt.payment_method}`,
    `ATENDIMENTO=${receipt.type}-${receipt.number}`,
    `DATA=${receipt.date}`,
    'STATUS=PENDENTE_EMISSAO_FISCAL',
  ].join('|')
}

export default function TableManager({ currentUser }: TableManagerProps) {
  const [viewMode, setViewMode] = useState<'salon' | 'hospital'>('salon')
  const [tables, setTables] = useState<TableItem[]>(initialTables)
  const [rooms, setRooms] = useState<TableItem[]>(initialRooms)
  const [activeItem, setActiveItem] = useState<TableItem | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isReprint, setIsReprint] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_RECEIPT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [printerSettings, setPrinterSettings] = useState<ReceiptPrinterSettings>(() =>
    readReceiptPrinterSettings(),
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [payLaterDueDate, setPayLaterDueDate] = useState('')
  const [fiscalCpf, setFiscalCpf] = useState('')
  const [selectedFloor, setSelectedFloor] = useState('todos')
  const [roomSearch, setRoomSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [orderMessage, setOrderMessage] = useState('')

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setAvailableProducts(data)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const openItem = (item: TableItem) => {
    const updatedItem = { ...item }
    if (updatedItem.status === 'Livre') {
      updatedItem.status = 'Ocupada'
    }
    setPaymentMethod('pix')
    setPayLaterDueDate('')
    setFiscalCpf('')
    setOrderMessage('')
    setActiveItem(updatedItem)
  }

  const closeItem = () => {
    setActiveItem(null)
  }

  const addProductToTable = (product: Product) => {
    if (!activeItem) return

    const newItem: OrderItem = {
      id: Date.now(),
      name: product.name,
      price: product.unit_price,
      quantity: 1,
      total: product.unit_price,
    }

    const updatedItem = {
      ...activeItem,
      items: [...activeItem.items, newItem],
    }

    updatedItem.total = updatedItem.items.reduce((sum, i) => sum + i.total, 0)
    setActiveItem(updatedItem)
  }

  const sendToPreparation = async () => {
    if (!activeItem || activeItem.items.length === 0) return

    const { error } = await supabase.from('service_orders').insert([
      {
        source_type: activeItem.type === 'table' ? 'mesa' : 'quarto',
        service_number: activeItem.number,
        customer_name: activeItem.customer_name,
        customer_phone: activeItem.customer_phone,
        items: activeItem.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        total_amount: activeItem.total,
        status: 'recebido',
        customer_message: 'Pedido recebido pelo PDV.',
      },
    ])

    if (error) {
      console.error('Erro ao enviar pedido:', error)
      setOrderMessage(
        'Nao foi possivel enviar para Pedidos feitos. Execute o SQL atualizado.',
      )
      return
    }

    setOrderMessage('Pedido enviado para a aba Pedidos feitos.')
  }

  const removeItem = (itemId: number) => {
    if (!activeItem) return

    const updatedItem = {
      ...activeItem,
      items: activeItem.items.filter((item) => item.id !== itemId),
    }

    updatedItem.total = updatedItem.items.reduce((sum, i) => sum + i.total, 0)
    setActiveItem(updatedItem)
  }

  const payCommand = () => {
    if (!activeItem) return

    if (paymentMethod === 'pagar_depois' && !canPayLater) {
      alert('Preencha nome e telefone para usar pagar depois.')
      return
    }

    const receiptBase: Omit<ReceiptData, 'fiscal_qr_text'> = {
      type: activeItem.type,
      number: activeItem.number,
      items: [...activeItem.items],
      total: activeItem.total,
      customer_name: activeItem.customer_name,
      customer_phone: activeItem.customer_phone,
      date: new Date().toLocaleString('pt-BR'),
      payment_method: paymentMethod,
      fiscal_cpf: fiscalCpf,
    }
    const receipt: ReceiptData = {
      ...receiptBase,
      fiscal_qr_text: createFiscalQrText(receiptBase),
    }

    setReceiptData(receipt)
    setIsReprint(false)
    setShowReceipt(true)
  }

  const refreshPrinterSettings = () => {
    setPrinterSettings(readReceiptPrinterSettings())
  }

  const printReceipt = () => {
    refreshPrinterSettings()
    document.body.classList.add('printing-receipt')
    const clearPrintMode = () => {
      document.body.classList.remove('printing-receipt')
      window.removeEventListener('afterprint', clearPrintMode)
      window.removeEventListener('focus', clearPrintMode)
    }

    window.addEventListener('afterprint', clearPrintMode)
    window.addEventListener('focus', clearPrintMode)
    window.setTimeout(() => {
      window.print()
      window.setTimeout(clearPrintMode, 2500)
    }, 50)
  }

  const closeReceiptPreview = () => {
    document.body.classList.remove('printing-receipt')
    setIsReprint(false)
    setShowReceipt(false)
  }

  const reprintLastReceipt = () => {
    if (!lastReceipt) return
    refreshPrinterSettings()
    setReceiptData(lastReceipt)
    setIsReprint(true)
    setShowReceipt(true)
  }

  const finalizePayment = async () => {
    if (!receiptData || !activeItem) return

    const salePayload = {
      table_number: receiptData.number,
      total_amount: receiptData.total,
      cashier_name: currentUser?.username || 'Desconhecido',
      customer_name: receiptData.customer_name,
      customer_phone: receiptData.customer_phone,
      fiscal_cpf: receiptData.fiscal_cpf || null,
      items: receiptData.items,
      payment_method: receiptData.payment_method,
    }

    try {
      const { error } = await supabase.from('sales').insert([salePayload])

      if (error) throw error

      localStorage.setItem(LAST_RECEIPT_KEY, JSON.stringify(receiptData))
      setLastReceipt(receiptData)

      if (receiptData.fiscal_cpf && isCompleteCpf(receiptData.fiscal_cpf)) {
        queueFiscalPayload(
          createFiscalPayload({
            customerCpf: receiptData.fiscal_cpf,
            totalAmount: receiptData.total,
            paymentMethod: receiptData.payment_method,
            items: receiptData.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit_price: item.price,
              total: item.total,
            })),
          }),
        )
      }

      if (receiptData.payment_method === 'pagar_depois') {
        const itemsDetail = receiptData.items
          .map((item) => `${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}`)
          .join('; ')
        const pendingPayload = {
          customer_name: receiptData.customer_name,
          phone: receiptData.customer_phone,
          position: activeItem.type === 'room' ? `Quarto ${activeItem.number}` : `Mesa ${activeItem.number}`,
          description: `Venda registrada em ${receiptData.date}`,
          items_detail: itemsDetail,
          total_amount: receiptData.total,
          purchase_date: new Date().toISOString().slice(0, 10),
          due_date: payLaterDueDate || new Date().toISOString().slice(0, 10),
          status: 'pendente',
        }

        const { error: pendingError } = await supabase
          .from('pending_payments')
          .insert([pendingPayload])

        if (pendingError) {
          const offlinePending = queueOfflineRecord(
            'pending_payments',
            pendingPayload,
            pendingError.message || 'Falha ao registrar pagar depois.',
          )
          logAppError({
            source: 'TableManager',
            action: 'finalizePayment.pendingPaymentQueue',
            error: pendingError,
            details: { offlineId: offlinePending.id },
          })
        }
      }

      // Atualizar o estado da mesa/quarto
      if (activeItem.type === 'table') {
        const updatedTables = tables.map((t) =>
          t.id === activeItem.id
            ? {
                ...t,
                items: [],
                total: 0,
                status: 'Livre' as const,
                customer_name: '',
                customer_phone: '',
              }
            : t
        )
        setTables(updatedTables)
      } else {
        const updatedRooms = rooms.map((r) =>
          r.id === activeItem.id
            ? {
                ...r,
                items: [],
                total: 0,
                status: 'Livre' as const,
                customer_name: '',
                customer_phone: '',
              }
            : r
        )
        setRooms(updatedRooms)
      }

      setActiveItem(null)
      setShowReceipt(false)
      setIsReprint(false)
      markBackupNeededAfterClosing('Venda registrada no PDV apos as 20:00')
      void openCashDrawer(receiptData.payment_method)
      alert('Venda registrada com sucesso no cofre!')
    } catch (err) {
      const offlineSale = queueOfflineSale(
        salePayload,
        (err as Error).message || 'Falha de conexao ou Supabase indisponivel.',
      )
      alert(
        `Venda salva em modo offline para sincronizar depois. Codigo local: ${offlineSale.id}`,
      )
    }
  }

  const updateActiveItemField = (field: string, value: string) => {
    if (!activeItem) return
    setActiveItem({ ...activeItem, [field]: value })
  }

  const canPayLater = Boolean(
    activeItem?.customer_name.trim() && activeItem?.customer_phone.trim(),
  )

  const roomFloors = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => Math.floor(room.number / 100))))
  }, [rooms])

  const currentList = useMemo(() => {
    if (viewMode === 'salon') return tables

    return rooms.filter((room) => {
      const matchesFloor =
        selectedFloor === 'todos' ||
        Math.floor(room.number / 100).toString() === selectedFloor
      const matchesSearch =
        !roomSearch.trim() || room.number.toString().includes(roomSearch.trim())

      return matchesFloor && matchesSearch
    })
  }, [rooms, roomSearch, selectedFloor, tables, viewMode])

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return availableProducts

    return availableProducts.filter((product) =>
      [product.name, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [availableProducts, productSearch])

  return (
    <div className="pdv-container">
      {!activeItem && (
        <>
          <div className="mode-selector no-print">
            <button
              className={`mode-btn ${viewMode === 'salon' ? 'active' : ''}`}
              onClick={() => setViewMode('salon')}
            >
              ☕ Salão (Mesas)
            </button>
            <button
              className={`mode-btn ${viewMode === 'hospital' ? 'active' : ''}`}
              onClick={() => setViewMode('hospital')}
            >
              🏥 Hospital (Quartos)
            </button>
            <button
              className="mode-btn"
              onClick={reprintLastReceipt}
              disabled={!lastReceipt}
            >
              Reimprimir ultimo cupom
            </button>
          </div>

          <div className="grid-view no-print">
            {viewMode === 'hospital' && (
              <div className="room-filters">
                <select
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(e.target.value)}
                >
                  <option value="todos">Todos os andares</option>
                  {roomFloors.map((floor) => (
                    <option key={floor} value={floor}>
                      Andar {floor}
                    </option>
                  ))}
                </select>
                <input
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Buscar quarto"
                />
              </div>
            )}
            <div className="cards-grid">
              {currentList.map((item) => (
                <div
                  key={item.id}
                  className={`item-card ${item.status === 'Livre' ? 'free' : 'occupied'}`}
                  onClick={() => openItem(item)}
                >
                  <h3>
                    {viewMode === 'salon' ? 'Mesa' : 'Quarto'} {item.number}
                  </h3>
                  <p className="status">{item.status}</p>
                  {item.customer_name && (
                    <p className="customer-info">👤 {item.customer_name}</p>
                  )}
                  {item.status === 'Ocupada' && (
                    <p className="total-tag">R$ {item.total.toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeItem && (
        <div className="command-view no-print">
          <header className="command-header">
            <button onClick={closeItem} className="btn-back">
              ⬅ Voltar
            </button>
            <h2>
              {activeItem.type === 'table' ? 'Mesa' : 'Quarto'} {activeItem.number}
            </h2>
            <div className="total-badge">R$ {activeItem.total.toFixed(2)}</div>
          </header>

          <div className="split-layout">
            <div className="products-showcase glass-panel">
              <div className="products-showcase-header">
                <h3>Produtos</h3>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Pesquisar produto"
                />
              </div>
              <div className="visual-menu">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`product-item-card ${
                      Number(product.low_stock_threshold || 0) > 0 &&
                      Number(product.stock_quantity || 0) <=
                        Number(product.low_stock_threshold || 0)
                        ? 'low-stock'
                        : ''
                    }`}
                    onClick={() => addProductToTable(product)}
                  >
                    <div className="img-wrapper">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className={`no-img-placeholder ${product.category === 'bebida' ? 'bebida' : 'comida'}`}>
                          <span>{product.category === 'bebida' ? 'Bebida' : 'Cafe'}</span>
                        </div>
                      )}
                    </div>
                    <div className="product-info-mini">
                      <span className="p-name">{product.name}</span>
                      <span className="p-price">
                        R$ {product.unit_price.toFixed(2)}
                      </span>
                      {Number(product.low_stock_threshold || 0) > 0 &&
                        Number(product.stock_quantity || 0) <=
                          Number(product.low_stock_threshold || 0) && (
                          <span className="p-stock-warning">Estoque baixo</span>
                        )}
                    </div>
                  </div>
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <p className="product-search-empty">Nenhum produto encontrado.</p>
              )}
            </div>

            <div className="active-command-panel">
              {activeItem.type === 'room' && (
                <div className="glass-panel hospital-fields">
                  <input
                    type="text"
                    value={activeItem.customer_name}
                    onChange={(e) =>
                      updateActiveItemField('customer_name', e.target.value)
                    }
                    placeholder="👤 Nome do Paciente/Acompanhante"
                  />
                  <input
                    type="text"
                    value={activeItem.customer_phone}
                    onChange={(e) =>
                      updateActiveItemField('customer_phone', e.target.value)
                    }
                    placeholder="📞 Ramal ou Telefone"
                  />
                </div>
              )}

              {activeItem.type === 'table' && (
                <div className="glass-panel hospital-fields">
                  <input
                    type="text"
                    value={activeItem.customer_name}
                    onChange={(e) =>
                      updateActiveItemField('customer_name', e.target.value)
                    }
                    placeholder="Nome do cliente"
                  />
                  <input
                    type="text"
                    value={activeItem.customer_phone}
                    onChange={(e) =>
                      updateActiveItemField('customer_phone', e.target.value)
                    }
                    placeholder="Telefone"
                  />
                </div>
              )}

              <div className="glass-panel items-list-panel">
                <h3>📝 Itens na Comanda</h3>
                {orderMessage && <p className="order-message">{orderMessage}</p>}
                {activeItem.items.length === 0 ? (
                  <p className="empty-state">
                    Toque em um produto ao lado para adicionar.
                  </p>
                ) : (
                  <div className="mobile-items-list">
                    {activeItem.items.map((item) => (
                      <div key={item.id} className="mobile-item">
                        <div className="item-details">
                          <span className="item-name">{item.name}</span>
                          <span className="item-price">
                            R$ {item.price.toFixed(2)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="btn-remove-item"
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeItem.items.length > 0 && (
                  <>
                    <button onClick={sendToPreparation} className="btn-send-order">
                      Enviar para preparo
                    </button>
                    {currentUser?.role !== 'garcom' ? (
                      <>
                        <div className="payment-methods">
                          <label>Forma de pagamento</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) =>
                              setPaymentMethod(e.target.value as PaymentMethod)
                            }
                          >
                            <option value="pix">Pix</option>
                            <option value="credito">Cartao de credito</option>
                            <option value="debito">Cartao de debito</option>
                            <option value="dinheiro">Dinheiro</option>
                            {canPayLater && (
                              <option value="pagar_depois">Pagar depois</option>
                            )}
                          </select>
                          {!canPayLater && (
                            <small>Preencha nome e telefone para liberar pagar depois.</small>
                          )}
                        </div>
                        {paymentMethod === 'pagar_depois' && (
                          <div className="payment-methods">
                            <label>Data combinada para pagamento</label>
                            <input
                              type="date"
                              value={payLaterDueDate}
                              onChange={(e) => setPayLaterDueDate(e.target.value)}
                            />
                            <small>Pagamento somente por Pix ou dinheiro.</small>
                          </div>
                        )}
                        <div className="payment-methods">
                          <label>CPF para Nota Fiscal Paulista</label>
                          <input
                            value={fiscalCpf}
                            onChange={(e) => setFiscalCpf(formatCpf(e.target.value))}
                            placeholder="123.456.789-10"
                            inputMode="numeric"
                            maxLength={14}
                          />
                          <small>Opcional. Use quando o cliente pedir CPF na nota.</small>
                        </div>
                        <button onClick={payCommand} className="btn-pay">
                          Encerrar e Pagar
                        </button>
                      </>
                    ) : (
                      <p className="garcom-aviso">
                        Pedido pode ser enviado para preparo. Pagamento fica com o caixa.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <>
          <div className="receipt-modal-overlay no-print">
            <div className="receipt-modal-content">
              <h2>Pagamento Pronto!</h2>
              <div className="modal-actions">
                <button onClick={printReceipt} className="btn-print">
                  🖨️ Imprimir Recibo
                </button>
                <button onClick={closeReceiptPreview} className="btn-close-receipt">
                  Fechar recibo
                </button>
                {!isReprint && (
                  <button onClick={finalizePayment} className="btn-close-receipt">
                    Confirmar no Sistema
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className={`printable-receipt ${
              printerSettings.compactMode ? 'compact' : ''
            } receipt-${printerSettings.paperWidth}`}
            style={
              {
                '--receipt-width': printerSettings.paperWidth,
                '--receipt-height': `${printerSettings.paperHeightMm}mm`,
                '--receipt-font-size': `${printerSettings.fontSizePt}pt`,
                '--receipt-line-height': printerSettings.lineHeight,
                '--receipt-logo-size': `${printerSettings.logoSizeMm}mm`,
                '--receipt-feed-space': `${printerSettings.bottomFeedMm}mm`,
              } as CSSProperties
            }
          >
            <div className="receipt-header">
              {printerSettings.logoEnabled && printerSettings.logoSizeMm > 0 && (
                <img className="receipt-logo" src="/logo.jpeg" alt="Dr. Cafe" />
              )}
              <h2>DR. CAFE</h2>
              <p>
                <strong>CUPOM NAO FISCAL</strong>
              </p>
              <hr />
            </div>
            <div className="receipt-section">
              <h3>Atendimento</h3>
              <p>
                {receiptData?.type === 'table' ? 'Mesa' : 'Quarto'}:{' '}
                {receiptData?.number}
              </p>
              {receiptData?.customer_name && <p>Cliente: {receiptData.customer_name}</p>}
              {receiptData?.customer_phone && <p>Telefone: {receiptData.customer_phone}</p>}
              {receiptData?.fiscal_cpf && <p>CPF NFP: {receiptData.fiscal_cpf}</p>}
              <p>Data: {receiptData?.date}</p>
            </div>
            <table className="receipt-table">
              <tbody>
                {receiptData?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.quantity}</td>
                    <td>{item.name}</td>
                    <td>R$ {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-footer">
              <hr />
              <p>Pagamento: {receiptData?.payment_method}</p>
              {receiptData?.payment_method === 'pagar_depois' && (
                <p>Pagamento combinado somente por Pix ou dinheiro.</p>
              )}
              <h3>TOTAL: R$ {receiptData?.total.toFixed(2)}</h3>
            </div>
            {receiptData?.fiscal_cpf && (
              <div className="receipt-fiscal">
                <h3>Nota Fiscal Paulista</h3>
                <div className="receipt-fiscal__qr" aria-label="QR Code da Nota Fiscal Paulista">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p>CPF: {receiptData.fiscal_cpf}</p>
                <p>QR Code fiscal pendente de emissao pela SEFAZ.</p>
                <small>{receiptData.fiscal_qr_text}</small>
              </div>
            )}
            <div className="receipt-feed-space" aria-hidden="true">
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
              <span>&nbsp;</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
