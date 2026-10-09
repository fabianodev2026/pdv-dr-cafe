import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './CustomerMenu.css'

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string | null
  image_url?: string | null
  category?: string | null
}

type MenuLocation =
  | { type: 'room'; number: number; label: string }
  | { type: 'table'; number: number; label: string }
  | null

interface CartItem {
  id: number
  name: string
  unit_price: number
  quantity: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type MenuTab = 'bebidas' | 'comidas' | 'fitness' | 'presentes'

const menuTabs: Array<{ id: MenuTab; label: string }> = [
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'comidas', label: 'Comidas' },
  { id: 'fitness', label: 'Comida fitness' },
  { id: 'presentes', label: 'Presentes' },
]

const fitnessKeywords = ['fitness', 'detox', 'natural', 'vitamina', 'salada', 'leve']

const getProductGroup = (product: Product): MenuTab => {
  const category = product.category?.toLowerCase() ?? ''
  const text = `${product.name} ${product.description ?? ''} ${category}`.toLowerCase()

  if (category.includes('bebida')) return 'bebidas'
  if (category.includes('presente')) return 'presentes'
  if (category.includes('fitness') || fitnessKeywords.some((keyword) => text.includes(keyword))) {
    return 'fitness'
  }

  return 'comidas'
}

export default function CustomerMenu() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [patientName, setPatientName] = useState('')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const [lastOrderId, setLastOrderId] = useState<number | null>(null)
  const [orderStatusMessage, setOrderStatusMessage] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>('bebidas')

  const menuLocation = useMemo<MenuLocation>(() => {
    const room = searchParams.get('room')?.trim()
    const table = searchParams.get('table')?.trim()
    const parsedRoom = Number(room)
    const parsedTable = Number(table)

    if (Number.isInteger(parsedRoom) && parsedRoom >= 101 && parsedRoom <= 315) {
      return { type: 'room', number: parsedRoom, label: `Quarto ${parsedRoom}` }
    }

    if (Number.isInteger(parsedTable) && parsedTable >= 1 && parsedTable <= 99) {
      return { type: 'table', number: parsedTable, label: `Mesa ${parsedTable}` }
    }

    return null
  }, [searchParams])

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart],
  )

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return products

    return products.filter((product) =>
      [product.name, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [productSearch, products])

  const productsByTab = useMemo(
    () =>
      menuTabs.reduce(
        (groups, tab) => ({
          ...groups,
          [tab.id]: filteredProducts.filter((product) => getProductGroup(product) === tab.id),
        }),
        { bebidas: [], comidas: [], fitness: [], presentes: [] } as Record<MenuTab, Product[]>,
      ),
    [filteredProducts],
  )

  const visibleProducts = productsByTab[activeMenuTab]

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, description, image_url, category')
        .order('name')

      if (error) {
        setMessage('Nao foi possivel carregar o cardapio.')
      } else {
        setProducts(data ?? [])
      }

      setIsLoading(false)
    }

    fetchProducts()
  }, [])

  useEffect(() => {
    if (!lastOrderId) return

    async function fetchOrderStatus() {
      const { data } = await supabase
        .from('room_orders')
        .select('status, customer_message')
        .eq('id', lastOrderId)
        .single()

      if (data?.customer_message) {
        setOrderStatusMessage(data.customer_message)
      }
    }

    fetchOrderStatus()
    const interval = window.setInterval(fetchOrderStatus, 10000)

    return () => window.clearInterval(interval)
  }, [lastOrderId])

  const addToCart = (product: Product) => {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id)

      if (existing) {
        return items.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      return [
        ...items,
        {
          id: product.id,
          name: product.name,
          unit_price: product.unit_price,
          quantity: 1,
        },
      ]
    })
  }

  const removeFromCart = (productId: number) => {
    setCart((items) => items.filter((item) => item.id !== productId))
  }

  const sendOrder = async () => {
    if (!menuLocation) {
      setMessage('Abra o cardapio pelo QR Code da mesa ou quarto.')
      return
    }

    if (!patientName.trim() || !phone.trim()) {
      setMessage('Informe nome e telefone.')
      return
    }

    if (cart.length === 0) {
      setMessage('Adicione pelo menos um produto ao pedido.')
      return
    }

    setIsSending(true)
    const orderPayload =
      menuLocation.type === 'room'
        ? {
            room_number: menuLocation.number,
            patient_name: patientName.trim(),
            phone: phone.trim(),
            items: cart,
            total_amount: total,
            status: 'novo',
            customer_message: 'Pedido enviado pelo QR Code do quarto. Pague quando receber.',
          }
        : {
            source_type: 'mesa',
            service_number: menuLocation.number,
            customer_name: patientName.trim(),
            customer_phone: phone.trim(),
            items: cart.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
            total_amount: total,
            status: 'recebido',
            customer_message: 'Pedido enviado pelo QR Code da mesa. Pague quando receber.',
          }

    const targetTable = menuLocation.type === 'room' ? 'room_orders' : 'service_orders'
    const { error } = await supabase.from(targetTable).insert([orderPayload])

    if (error) {
      console.error('Erro ao enviar pedido:', error)
      setMessage(`Nao foi possivel enviar o pedido: ${error.message}`)
    } else {
      const { data: latestOrder } = await supabase
        .from('room_orders')
        .select('id')
        .eq('room_number', menuLocation.type === 'room' ? menuLocation.number : 0)
        .eq('phone', phone.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setCart([])
      setPatientName('')
      setPhone('')
      setLastOrderId(latestOrder?.id ?? null)
      setOrderStatusMessage('Pedido enviado para o PDV. Pague quando receber.')
      setMessage('Pedido enviado para o PDV. Pague quando receber.')
    }

    setIsSending(false)
  }

  return (
    <main className="customer-menu">
      <header className="customer-menu__header">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <p className="customer-menu__eyebrow">Dr. Cafe</p>
          <h1>Cardapio</h1>
        </div>
        <span className="customer-menu__room">
          {menuLocation ? menuLocation.label : 'Mesa/quarto nao informado'}
        </span>
      </header>

      <section className="customer-menu__patient">
        <input
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder={menuLocation?.type === 'room' ? 'Nome do paciente' : 'Nome do cliente'}
          maxLength={40}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone"
          maxLength={20}
        />
      </section>

      <section className="customer-menu__payment-note">
        <strong>Pagamento no recebimento</strong>
        <span>Escolha os produtos pelo QR Code. O pedido aparece no PDV do cafe e voce paga quando receber.</span>
      </section>

      <section className="customer-menu__filters">
        <div className="customer-menu__product-link-status">
          <strong>Cardapio vinculado aos produtos do PDV</strong>
          <span>{products.length} produto(s) carregado(s) do cadastro do cafe.</span>
        </div>
        <input
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          placeholder="Pesquisar produto"
        />
        <div className="customer-menu__tabs">
          {menuTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeMenuTab === tab.id ? 'active' : ''}
              onClick={() => setActiveMenuTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {isLoading && <p className="customer-menu__state">Carregando cardapio...</p>}
      {message && <p className="customer-menu__state">{message}</p>}
      {orderStatusMessage && (
        <p className="customer-menu__state customer-menu__status-alert">
          {orderStatusMessage}
        </p>
      )}

      <section className="customer-menu__layout">
        <aside className="customer-menu__cart">
          <div className="customer-menu__cart-heading">
            <div>
              <span>Seu pedido</span>
              <h2>{currencyFormatter.format(total)}</h2>
            </div>
            <strong>{cart.length} item(ns)</strong>
          </div>
          {cart.length === 0 ? (
            <p>Nenhum item adicionado.</p>
          ) : (
            cart.map((item) => (
              <div className="customer-menu__cart-item" key={item.id}>
                <span>{item.quantity}x {item.name}</span>
                <button onClick={() => removeFromCart(item.id)}>Remover</button>
              </div>
            ))
          )}
          <button onClick={sendOrder} disabled={isSending}>
            {isSending ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </aside>

        <section className="customer-menu__products-panel">
          <div className="customer-menu__section-heading">
            <h2>{menuTabs.find((tab) => tab.id === activeMenuTab)?.label}</h2>
            <span>{visibleProducts.length} produto(s)</span>
          </div>
        <div className="customer-menu__grid" aria-label="Produtos">
          {visibleProducts.map((product) => (
            <article className="customer-menu__item" key={product.id}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div
                  className={`customer-menu__image-fallback ${getProductGroup(product)}`}
                  aria-hidden="true"
                >
                  {getProductGroup(product) === 'bebidas'
                    ? 'Bebida'
                    : getProductGroup(product) === 'presentes'
                      ? 'Presente'
                      : 'Dr. Cafe'}
                </div>
              )}
              <div className="customer-menu__info">
                <div className="customer-menu__line">
                  <h2>{product.name.slice(0, 25)}</h2>
                  <strong>{currencyFormatter.format(product.unit_price)}</strong>
                </div>
                {product.description && <p>{product.description.slice(0, 25)}</p>}
                <button onClick={() => addToCart(product)}>Adicionar</button>
              </div>
            </article>
          ))}
        </div>
                {visibleProducts.length === 0 && (
                  <p className="customer-menu__empty">
                    Nenhum produto encontrado nesta aba. Confira os produtos cadastrados no PDV.
                  </p>
                )}
        </section>
      </section>
    </main>
  )
}
