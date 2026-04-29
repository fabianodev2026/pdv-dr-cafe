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
}

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

  const roomNumber = useMemo(() => {
    const room = searchParams.get('room')?.trim()
    const parsed = Number(room)
    return Number.isInteger(parsed) && parsed >= 101 && parsed <= 315
      ? parsed
      : null
  }, [searchParams])

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart],
  )

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, description, image_url')
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
    if (!roomNumber) {
      setMessage('Abra o cardapio pelo QR Code do quarto.')
      return
    }

    if (!patientName.trim() || !phone.trim()) {
      setMessage('Informe nome do paciente e telefone.')
      return
    }

    if (cart.length === 0) {
      setMessage('Adicione pelo menos um produto ao pedido.')
      return
    }

    setIsSending(true)
    const { data, error } = await supabase
      .from('room_orders')
      .insert([
        {
          room_number: roomNumber,
          patient_name: patientName.trim(),
          phone: phone.trim(),
          items: cart,
          total_amount: total,
          status: 'novo',
          customer_message: 'Pedido enviado para o PDV.',
        },
      ])
      .select('id')
      .single()

    if (error) {
      console.error('Erro ao enviar pedido:', error)
      setMessage('Nao foi possivel enviar o pedido. Chame a recepcao.')
    } else {
      setCart([])
      setPatientName('')
      setPhone('')
      setLastOrderId(data?.id ?? null)
      setOrderStatusMessage('Pedido enviado para o PDV.')
      setMessage('Pedido enviado para o PDV.')
    }

    setIsSending(false)
  }

  return (
    <main className="customer-menu">
      <header className="customer-menu__header">
        <div>
          <p className="customer-menu__eyebrow">Dr. Cafe</p>
          <h1>Cardapio</h1>
        </div>
        <span className="customer-menu__room">
          {roomNumber ? `Quarto ${roomNumber}` : 'Quarto nao informado'}
        </span>
      </header>

      <section className="customer-menu__patient">
        <input
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="Nome do paciente"
          maxLength={40}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone"
          maxLength={20}
        />
      </section>

      {isLoading && <p className="customer-menu__state">Carregando cardapio...</p>}
      {message && <p className="customer-menu__state">{message}</p>}
      {orderStatusMessage && (
        <p className="customer-menu__state customer-menu__status-alert">
          {orderStatusMessage}
        </p>
      )}

      <section className="customer-menu__layout">
        <div className="customer-menu__grid" aria-label="Produtos">
          {products.map((product) => (
            <article className="customer-menu__item" key={product.id}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="customer-menu__image-fallback" aria-hidden="true">
                  Dr.
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

        <aside className="customer-menu__cart">
          <h2>Pedido</h2>
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
          <strong>Total: {currencyFormatter.format(total)}</strong>
          <button onClick={sendOrder} disabled={isSending}>
            {isSending ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </aside>
      </section>
    </main>
  )
}
