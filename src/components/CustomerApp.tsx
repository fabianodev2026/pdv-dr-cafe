import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CustomerApp.css'

type CustomerStatus = 'pendente' | 'ativo' | 'bloqueado'

interface AppCustomer {
  id: number
  name: string
  phone: string
  position: string
  email: string
  status: CustomerStatus
  payment_day: number
}

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string
  image_url?: string
  category?: 'comida' | 'bebida'
}

interface DailyLunch {
  id: number
  dish_name: string
  description?: string
  price: number
  image_url?: string
}

interface CartItem {
  id: string
  name: string
  quantity: number
  unit_price: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const getFifthBusinessDay = () => {
  const now = new Date()
  const targetMonth = now.getMonth() + 1
  const date = new Date(now.getFullYear(), targetMonth, 1)
  let businessDays = 0

  while (businessDays < 5) {
    const weekDay = date.getDay()
    if (weekDay !== 0 && weekDay !== 6) businessDays += 1
    if (businessDays < 5) date.setDate(date.getDate() + 1)
  }

  return date.toISOString().slice(0, 10)
}

const dateDiffInDays = (date: string) => {
  const today = new Date()
  const target = new Date(`${date}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export default function CustomerApp() {
  const [customer, setCustomer] = useState<AppCustomer | null>(null)
  const [phoneLogin, setPhoneLogin] = useState('')
  const [message, setMessage] = useState('')
  const [menuMessage, setMenuMessage] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [dailyLunch, setDailyLunch] = useState<DailyLunch | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [nextDueDate, setNextDueDate] = useState('')
  const [isBlockedByDebt, setIsBlockedByDebt] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    position: '',
    email: '',
  })

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [cart],
  )

  const foods = products.filter((product) => product.category !== 'bebida')
  const drinks = products.filter((product) => product.category === 'bebida')

  const loadMenu = async () => {
    const productsResult = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (!productsResult.error) {
      setProducts(productsResult.data ?? [])
    } else {
      console.error('Erro ao carregar produtos do app:', productsResult.error)
      setMenuMessage('Cardapio temporariamente indisponivel.')
    }

    const lunchResult = await supabase
      .from('daily_lunches')
      .select('*')
      .eq('active', true)
      .gte('serving_date', new Date().toISOString().slice(0, 10))
      .order('serving_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!lunchResult.error && lunchResult.data) {
      setDailyLunch(lunchResult.data)
    } else if (lunchResult.error) {
      console.error('Erro ao carregar almoco do dia:', lunchResult.error)
    }
  }

  const loadPending = async (phone: string) => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('phone', phone)
      .eq('status', 'pendente')

    if (error) {
      console.error('Erro ao carregar consumo em aberto:', error)
      setPendingTotal(0)
      setNextDueDate(getFifthBusinessDay())
      setIsBlockedByDebt(false)
      return
    }

    const payments = data ?? []
    const totalDebt = payments.reduce(
      (sum, payment) => sum + Number(payment.total_amount),
      0,
    )
    const overdue = payments.some((payment) => dateDiffInDays(payment.due_date) < -3)
    const closestDue = payments
      .map((payment) => payment.due_date)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]

    setPendingTotal(totalDebt)
    setNextDueDate(closestDue || getFifthBusinessDay())
    setIsBlockedByDebt(overdue)
  }

  useEffect(() => {
    loadMenu()
    const savedPhone = localStorage.getItem('dr-cafe-app-phone')
    if (savedPhone) {
      setPhoneLogin(savedPhone)
      loginByPhone(savedPhone)
    }
  }, [])

  const loginByPhone = async (phone = phoneLogin) => {
    if (!phone.trim()) {
      setMessage('Digite o telefone cadastrado.')
      return
    }

    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .eq('phone', phone.trim())
      .maybeSingle()

    if (error || !data) {
      if (error) console.error('Erro ao consultar cadastro do app:', error)
      setMessage('Cadastro nao encontrado. Faca seu cadastro abaixo.')
      return
    }

    setCustomer(data)
    localStorage.setItem('dr-cafe-app-phone', data.phone)
    setMessage('')
    loadPending(data.phone)
  }

  const registerCustomer = async () => {
    if (!form.name || !form.phone || !form.position || !form.email) {
      setMessage('Preencha nome, telefone, cargo e email.')
      return
    }

    const { error } = await supabase.from('app_customers').upsert(
      [
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          position: form.position.trim(),
          email: form.email.trim(),
          status: 'pendente',
          payment_day: 5,
        },
      ],
      { onConflict: 'phone' },
    )

    if (error) {
      console.error('Erro no cadastro do app:', error)
      setMessage('Nao foi possivel enviar o cadastro agora. Tente novamente em instantes.')
      return
    }

    setPhoneLogin(form.phone)
    setMessage(
      'Cadastro enviado com sucesso. O cafe precisa liberar seu acesso antes do primeiro pedido.',
    )
  }

  const addToCart = (item: { id: string; name: string; unit_price: number }) => {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        )
      }

      return [...current, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const sendOrder = async () => {
    if (!customer) return

    if (customer.status !== 'ativo' || isBlockedByDebt) {
      setMessage('Sua conta nao esta liberada para novos pedidos.')
      return
    }

    if (cart.length === 0) {
      setMessage('Adicione pelo menos um item.')
      return
    }

    const dueDate = getFifthBusinessDay()
    const orderItems = cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    const { error: orderError } = await supabase.from('app_orders').insert([
      {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        items: orderItems,
        total_amount: total,
        status: 'novo',
        customer_message: 'Pedido enviado pelo app.',
      },
    ])

    if (orderError) {
      console.error('Erro ao enviar pedido pelo app:', orderError)
      setMessage('Nao foi possivel enviar o pedido agora. Tente novamente em instantes.')
      return
    }

    const itemsDetail = cart
      .map((item) => `${item.quantity}x ${item.name} - R$ ${(item.quantity * item.unit_price).toFixed(2)}`)
      .join('; ')

    const { error: pendingError } = await supabase.from('pending_payments').insert([
      {
        customer_name: customer.name,
        phone: customer.phone,
        position: customer.position,
        description: 'Compra pelo app Dr. Cafe',
        items_detail: itemsDetail,
        total_amount: total,
        purchase_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        status: 'pendente',
      },
    ])

    if (pendingError) {
      console.error('Erro ao registrar pagar depois pelo app:', pendingError)
      setMessage('Pedido enviado. O cafe vai conferir seu consumo no sistema.')
      return
    }

    setCart([])
    setMessage(
      'Pedido enviado. Seu cadastro foi feito com sucesso; sua forma de pagamento sera todo dia 5 util.',
    )
    loadPending(customer.phone)
  }

  const dueWarning =
    nextDueDate && dateDiffInDays(nextDueDate) <= 5 && dateDiffInDays(nextDueDate) >= 0

  return (
    <div className="customer-app">
      <header className="customer-app__hero">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <p>App Dr. Cafe</p>
          <h1>Cardapio e pagar depois</h1>
        </div>
      </header>

      {message && <div className="customer-app__alert">{message}</div>}
      {menuMessage && <div className="customer-app__alert">{menuMessage}</div>}

      {!customer && (
        <section className="customer-app__auth">
          <div className="customer-app__panel">
            <h2>Entrar</h2>
            <input
              value={phoneLogin}
              onChange={(e) => setPhoneLogin(e.target.value)}
              placeholder="Telefone cadastrado"
            />
            <button onClick={() => loginByPhone()}>Entrar no app</button>
          </div>

          <div className="customer-app__panel">
            <h2>Novo cadastro</h2>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Telefone"
            />
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="Cargo"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
            />
            <button onClick={registerCustomer}>Enviar cadastro</button>
            <small>
              O cafe confirma o cadastro no sistema. Depois disso o app libera os
              pedidos em pagar depois.
            </small>
          </div>
        </section>
      )}

      {customer && (
        <>
          <section className="customer-app__account">
            <div>
              <strong>{customer.name}</strong>
              <span>{customer.position}</span>
              <span>Status: {customer.status}</span>
            </div>
            <div>
              <strong>{currencyFormatter.format(pendingTotal)}</strong>
              <span>em aberto</span>
              <span>Vencimento: {new Date(`${nextDueDate}T00:00:00`).toLocaleDateString('pt-BR')}</span>
            </div>
          </section>

          {dueWarning && (
            <div className="customer-app__warning">
              Sua conta fecha em ate 5 dias. Pagamento somente Pix ou dinheiro.
            </div>
          )}

          {isBlockedByDebt && (
            <div className="customer-app__blocked">
              Conta bloqueada por atraso superior a 3 dias. Procure o cafe para
              regularizar.
            </div>
          )}

          <main className="customer-app__layout">
            <section className="customer-app__menu">
              {dailyLunch && (
                <div className="customer-app__section">
                  <h2>Almoco do dia</h2>
                  <article className="customer-app__item customer-app__item--lunch">
                    {dailyLunch.image_url && (
                      <img src={dailyLunch.image_url} alt={dailyLunch.dish_name} />
                    )}
                    <div>
                      <strong>{dailyLunch.dish_name}</strong>
                      <p>{dailyLunch.description}</p>
                      <span>{currencyFormatter.format(Number(dailyLunch.price))}</span>
                      <button
                        onClick={() =>
                          addToCart({
                            id: `lunch-${dailyLunch.id}`,
                            name: dailyLunch.dish_name,
                            unit_price: Number(dailyLunch.price),
                          })
                        }
                      >
                        Pedir almoco
                      </button>
                    </div>
                  </article>
                </div>
              )}

              <div className="customer-app__section">
                <h2>Produtos do cafe</h2>
                <div className="customer-app__grid">
                  {foods.map((product) => (
                    <MenuItem key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              </div>

              <div className="customer-app__section">
                <h2>Bebidas</h2>
                <div className="customer-app__grid">
                  {drinks.map((product) => (
                    <MenuItem key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              </div>
            </section>

            <aside className="customer-app__cart">
              <h2>Pedido</h2>
              {cart.length === 0 ? (
                <p>Nenhum item ainda.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="customer-app__cart-item">
                    <span>{item.quantity}x {item.name}</span>
                    <strong>
                      {currencyFormatter.format(item.quantity * item.unit_price)}
                    </strong>
                    <button onClick={() => removeFromCart(item.id)}>Remover</button>
                  </div>
                ))
              )}
              <strong>Total: {currencyFormatter.format(total)}</strong>
              <p>Pagamento: pagar depois, Pix ou dinheiro no dia combinado.</p>
              <button
                onClick={sendOrder}
                disabled={customer.status !== 'ativo' || isBlockedByDebt}
              >
                Enviar pedido
              </button>
            </aside>
          </main>
        </>
      )}
    </div>
  )
}

function MenuItem({
  product,
  onAdd,
}: {
  product: Product
  onAdd: (item: { id: string; name: string; unit_price: number }) => void
}) {
  return (
    <article className="customer-app__item">
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} />
      ) : (
        <div className="customer-app__fallback">Dr. Cafe</div>
      )}
      <div>
        <strong>{product.name}</strong>
        {product.description && <p>{product.description}</p>}
        <span>{currencyFormatter.format(Number(product.unit_price))}</span>
        <button
          onClick={() =>
            onAdd({
              id: `product-${product.id}`,
              name: product.name,
              unit_price: Number(product.unit_price),
            })
          }
        >
          Adicionar
        </button>
      </div>
    </article>
  )
}
