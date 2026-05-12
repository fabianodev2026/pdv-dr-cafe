import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logAppError, normalizeError } from '../lib/appLogger'
import { markBackupNeededAfterClosing } from '../lib/backupService'
import { customerFieldLimits } from '../lib/customerLimits'
import './CustomerApp.css'

type CustomerStatus = 'pendente' | 'ativo' | 'bloqueado'
type AppMessageType = 'info' | 'success' | 'error'

interface AppCustomer {
  id: number
  name: string
  login: string
  phone: string
  position: string
  email: string
  status: CustomerStatus
  payment_day: number
  credit_limit: number
}

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string
  image_url?: string
  category?: string
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

interface PendingPayment {
  id: number
  description?: string
  items_detail?: string
  total_amount: number
  purchase_date: string
  due_date: string
  status: string
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const toMoney = (value: number) => Number(value.toFixed(2))

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

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

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

export default function CustomerApp() {
  const [customer, setCustomer] = useState<AppCustomer | null>(null)
  const [loginForm, setLoginForm] = useState({ login: '', password: '' })
  const [resetForm, setResetForm] = useState({ login: '', email: '' })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<AppMessageType>('info')
  const [menuMessage, setMenuMessage] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [tokenResetForm, setTokenResetForm] = useState({
    token: '',
    password: '',
    confirmPassword: '',
  })
  const [showTokenPasswordReset, setShowTokenPasswordReset] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>('bebidas')
  const [dailyLunch, setDailyLunch] = useState<DailyLunch | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [nextDueDate, setNextDueDate] = useState('')
  const [isBlockedByDebt, setIsBlockedByDebt] = useState(false)
  const [form, setForm] = useState({
    name: '',
    login: '',
    password: '',
    phone: '',
    position: '',
    email: '',
    emailConfirmation: '',
  })

  const total = useMemo(
    () =>
      toMoney(cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)),
    [cart],
  )
  const creditLimit = Number(customer?.credit_limit || 0)
  const availableCredit = Math.max(creditLimit - pendingTotal, 0)
  const availableAfterCart = Math.max(availableCredit - total, 0)

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return products

    return products.filter((product) =>
      [product.name, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [products, productSearch])

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

  const showMessage = (text: string, type: AppMessageType = 'info') => {
    setMessageType(type)
    setMessage(text)
  }

  const visibleProducts = productsByTab[activeMenuTab]

  const loadMenu = async () => {
    const productsResult = await supabase.from('products').select('*').order('name')

    if (!productsResult.error) {
      setProducts(productsResult.data ?? [])
    } else {
      logAppError({
        source: 'CustomerApp',
        action: 'loadMenu.products',
        error: productsResult.error,
        details: { table: 'products' },
      })
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
      logAppError({
        source: 'CustomerApp',
        action: 'loadMenu.dailyLunch',
        error: lunchResult.error,
        details: { table: 'daily_lunches' },
      })
    }
  }

  const loadPending = async (phone: string) => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('phone', phone)
      .eq('status', 'pendente')

    if (error) {
      logAppError({
        source: 'CustomerApp',
        action: 'loadPending',
        error,
        details: { table: 'pending_payments' },
      })
      setPendingTotal(0)
      setPendingPayments([])
      setNextDueDate(getFifthBusinessDay())
      setIsBlockedByDebt(false)
      return
    }

    const payments = data ?? []
    setPendingPayments(payments)
    const totalDebt = toMoney(
      payments.reduce((sum, payment) => sum + Number(payment.total_amount), 0),
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
    const savedLogin = localStorage.getItem('dr-cafe-app-login')
    if (savedLogin) {
      setLoginForm((current) => ({ ...current, login: savedLogin }))
    }

    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verify_email')
    const resetToken = params.get('reset_password')

    if (verifyToken) {
      const verifyEmail = async () => {
        try {
          const { data, error } = await supabase.rpc('app_customer_verify_email', {
            p_token: verifyToken,
          })

          if (error || data !== true) {
            setMessage('Nao foi possivel confirmar este email. Solicite um novo cadastro ou fale com o cafe.')
            return
          }

          setMessage('Email confirmado com sucesso. Aguarde o cafe liberar seu acesso.')
        } catch (error) {
          logAppError({
            source: 'CustomerApp',
            action: 'verifyEmailToken',
            error,
            details: { hasToken: true },
          })
          setMessage('Nao foi possivel confirmar este email agora.')
        }
      }

      verifyEmail()
      window.history.replaceState({}, '', '/app')
    }

    if (resetToken) {
      setTokenResetForm((current) => ({ ...current, token: resetToken }))
      setShowTokenPasswordReset(true)
      setShowPasswordReset(false)
      setMessage('Digite sua nova senha para concluir a recuperacao.')
      window.history.replaceState({}, '', '/app')
    }
  }, [])

  const loginCustomer = async () => {
    const login = loginForm.login.trim()
    const password = loginForm.password.trim()

    if (!login || !password) {
      setMessage('Digite login e senha.')
      return
    }

    const { data, error } = await supabase
      .rpc('app_customer_login', {
        p_login: login,
        p_password: password,
      })

    if (error) {
      const normalized = normalizeError(error)
      logAppError({
        source: 'CustomerApp',
        action: 'loginCustomer',
        error,
        details: {
          table: 'app_customers',
          hasLogin: Boolean(login),
          hasPassword: Boolean(password),
        },
      })
      setMessage(
        `Nao foi possivel entrar agora. Codigo suporte: ${normalized.code || 'LOGIN-RPC'}.`,
      )
      return
    }

    const customerData = Array.isArray(data) ? data[0] : null

    if (!customerData) {
      setMessage('Login ou senha incorretos. Se ainda nao tem acesso, faca seu cadastro.')
      return
    }

    if (customerData.status === 'pendente') {
      setMessage('Cadastro recebido. Aguarde o cafe liberar seu acesso.')
      return
    }

    if (customerData.status === 'bloqueado') {
      setMessage('Cadastro bloqueado. Procure o cafe para regularizar.')
      return
    }

    setCustomer({
      ...customerData,
      position: customerData.position ?? customerData.customer_position,
    })
    localStorage.setItem('dr-cafe-app-login', customerData.login)
    setMessage('')
    loadPending(customerData.phone)
  }

  const registerCustomer = async () => {
    if (
      !form.name ||
      !form.login ||
      !form.password ||
      !form.phone ||
      !form.position ||
      !form.email ||
      !form.emailConfirmation
    ) {
      showMessage('Preencha nome, login, senha, telefone, cargo, email e confirmacao do email.', 'error')
      return
    }

    if (form.email.trim().toLowerCase() !== form.emailConfirmation.trim().toLowerCase()) {
      showMessage('O email e a confirmacao do email precisam ser iguais.', 'error')
      return
    }

    if (
      form.name.length > customerFieldLimits.name ||
      form.login.length > customerFieldLimits.login ||
      form.password.length > customerFieldLimits.password ||
      form.phone.length > customerFieldLimits.phone ||
      form.position.length > customerFieldLimits.position ||
      form.email.length > customerFieldLimits.email ||
      form.emailConfirmation.length > customerFieldLimits.email
    ) {
      showMessage(
        `Nome ate ${customerFieldLimits.name}, login ate ${customerFieldLimits.login}, senha ate ${customerFieldLimits.password}, telefone ate ${customerFieldLimits.phone}, cargo ate ${customerFieldLimits.position} e email ate ${customerFieldLimits.email} caracteres.`,
        'error',
      )
      return
    }

    const { error } = await supabase.rpc('app_customer_register', {
      p_name: form.name.trim(),
      p_login: form.login.trim(),
      p_password: form.password.trim(),
      p_phone: form.phone.trim(),
      p_position: form.position.trim(),
      p_email: form.email.trim().toLowerCase(),
    })

    if (error) {
      const normalized = normalizeError(error)
      logAppError({
        source: 'CustomerApp',
        action: 'registerCustomer',
        error,
        details: {
          table: 'app_customers',
          formState: {
            hasName: Boolean(form.name),
            hasLogin: Boolean(form.login),
            hasPassword: Boolean(form.password),
            hasPhone: Boolean(form.phone),
            hasPosition: Boolean(form.position),
            hasEmail: Boolean(form.email),
          },
        },
      })
      if (error.code === '23505') {
        showMessage('Este login ou email ja tem cadastro. Use outro ou fale com o cafe.', 'error')
        return
      }

      if (error.message.includes('app_customers_email_length')) {
        showMessage(
          `Email muito longo. Use um email com ate ${customerFieldLimits.email} caracteres.`,
          'error',
        )
        return
      }

      if (
        error.message.includes('Preencha') ||
        error.message.includes('Login') ||
        error.message.includes('login') ||
        error.message.includes('Telefone') ||
        error.message.includes('telefone') ||
        error.message.includes('Email') ||
        error.message.includes('email') ||
        error.message.includes('Nome') ||
        error.message.includes('Senha') ||
        error.message.includes('Cargo')
      ) {
        showMessage(error.message, 'error')
        return
      }

      if (error.code === '42P01' || error.message.includes('schema cache')) {
        showMessage('Cadastro do app ainda esta sendo configurado. Avise o cafe.', 'error')
        return
      }

      showMessage(
        `Nao foi possivel enviar o cadastro agora. Codigo suporte: ${normalized.code || 'CAD-RPC'}.`,
        'error',
      )
      return
    }

    setLoginForm({ login: form.login, password: '' })
    showMessage(
      'Cadastro enviado. Enviamos um email de verificacao; confirme o email e aguarde o cafe liberar seu acesso.',
      'success',
    )
  }

  const requestCustomerPasswordReset = async () => {
    const login = resetForm.login.trim()
    const email = resetForm.email.trim().toLowerCase()

    if (!login || !email) {
      setMessage('Preencha login e email cadastrado.')
      return
    }

    if (
      login.length > customerFieldLimits.login ||
      email.length > customerFieldLimits.email
    ) {
      setMessage(
        `Login ate ${customerFieldLimits.login} e email ate ${customerFieldLimits.email} caracteres.`,
      )
      return
    }

    const { error } = await supabase.rpc('app_customer_request_password_reset', {
      p_login: login,
      p_email: email,
    })

    if (error) {
      const normalized = normalizeError(error)
      logAppError({
        source: 'CustomerApp',
        action: 'requestCustomerPasswordReset',
        error,
        details: { table: 'app_customers', hasLogin: Boolean(login), hasEmail: Boolean(email) },
      })
      setMessage(
        `Nao foi possivel solicitar recuperacao agora. Codigo suporte: ${normalized.code || 'RESET-RPC'}.`,
      )
      return
    }

    setResetForm({ login: '', email: '' })
    setShowPasswordReset(false)
    setMessage('Se o login e email estiverem corretos, enviamos um link para trocar a senha.')
  }

  const resetCustomerPasswordWithToken = async () => {
    const token = tokenResetForm.token.trim()
    const password = tokenResetForm.password.trim()
    const confirmPassword = tokenResetForm.confirmPassword.trim()

    if (!token || !password || !confirmPassword) {
      setMessage('Preencha a nova senha e a confirmacao.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('A nova senha e a confirmacao precisam ser iguais.')
      return
    }

    if (password.length > customerFieldLimits.password) {
      setMessage(`Senha ate ${customerFieldLimits.password} caracteres.`)
      return
    }

    const { data, error } = await supabase.rpc('app_customer_reset_password_with_token', {
      p_token: token,
      p_new_password: password,
    })

    if (error || data !== true) {
      const normalized = error ? normalizeError(error) : { code: 'RESET-TOKEN' }
      logAppError({
        source: 'CustomerApp',
        action: 'resetCustomerPasswordWithToken',
        error: error ?? new Error('Token reset returned false'),
        details: { hasToken: Boolean(token) },
      })
      setMessage(
        `Nao foi possivel trocar a senha. Codigo suporte: ${normalized.code || 'RESET-TOKEN'}.`,
      )
      return
    }

    setTokenResetForm({ token: '', password: '', confirmPassword: '' })
    setShowTokenPasswordReset(false)
    setMessage('Senha alterada com sucesso. Entre com sua nova senha.')
  }

  const addToCart = (item: { id: string; name: string; unit_price: number }) => {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
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

    if (creditLimit > 0 && total > availableCredit) {
      setMessage('Pedido acima do limite disponivel. Procure o cafe para ajustar seu limite.')
      return
    }

    const dueDate = getFifthBusinessDay()
    const orderItems = cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
    const orderTotal = toMoney(total)

    const { error: orderError } = await supabase.from('app_orders').insert([
      {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        items: orderItems,
        total_amount: orderTotal,
        status: 'novo',
        customer_message: 'Pedido enviado pelo app.',
      },
    ])

    if (orderError) {
      logAppError({
        source: 'CustomerApp',
        action: 'sendOrder.appOrder',
        error: orderError,
        details: { table: 'app_orders', itemCount: cart.length, total: orderTotal },
      })
      setMessage('Nao foi possivel enviar o pedido agora. Tente novamente em instantes.')
      return
    }

    const itemsDetail = cart
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - R$ ${(item.quantity * item.unit_price).toFixed(2)}`,
      )
      .join('; ')

    const { error: pendingError } = await supabase.from('pending_payments').insert([
      {
        customer_name: customer.name,
        phone: customer.phone,
        position: customer.position,
        description: 'Compra pelo app Dr. Cafe',
        items_detail: itemsDetail,
        total_amount: orderTotal,
        purchase_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        status: 'pendente',
      },
    ])

    if (pendingError) {
      logAppError({
        source: 'CustomerApp',
        action: 'sendOrder.pendingPayment',
        error: pendingError,
        details: { table: 'pending_payments', itemCount: cart.length, total: orderTotal },
      })
      setMessage('Pedido enviado. O cafe vai conferir seu consumo no sistema.')
      return
    }

    setCart([])
    markBackupNeededAfterClosing('Pedido do app registrado apos as 20:00')
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
          <p>DR. CAFÉ</p>
          <h1>Faça Seu Pedido</h1>
        </div>
      </header>

      {message && (
        <div className={`customer-app__alert customer-app__alert--${messageType}`}>
          <strong>
            {messageType === 'error'
              ? 'Atenção'
              : messageType === 'success'
                ? 'Tudo certo'
                : 'Aviso'}
          </strong>
          <span>{message}</span>
        </div>
      )}
      {menuMessage && <div className="customer-app__alert">{menuMessage}</div>}

      {!customer && (
        <section className="customer-app__auth">
          <div className="customer-app__auth-card customer-app__auth-card--brand">
            <div className="customer-app__auth-brand">
              <img src="/logo.jpeg" alt="Dr. Cafe" />
              <div>
                <span>Dr. Cafe</span>
                <strong>Cuidando de voce</strong>
              </div>
            </div>
            <div className="customer-app__auth-callout">
              <span>Pedido pelo app</span>
              <strong>Escolha, envie e acompanhe seu saldo.</strong>
            </div>
          </div>

          <div className="customer-app__panel">
            <span className="customer-app__panel-kicker">Acesso</span>
            <h2>Entrar</h2>
            <input
              value={loginForm.login}
              onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
              placeholder="Login"
              maxLength={customerFieldLimits.login}
            />
            <div className="customer-app__password-field">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="Senha"
                maxLength={customerFieldLimits.password}
              />
              <button type="button" onClick={() => setShowLoginPassword((current) => !current)}>
                {showLoginPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <button onClick={loginCustomer}>Entrar no app</button>
            <button
              type="button"
              className="customer-app__link-button"
              onClick={() => setShowPasswordReset((current) => !current)}
            >
              Esqueci a senha
            </button>
          </div>

          {showPasswordReset && (
            <div className="customer-app__panel">
              <span className="customer-app__panel-kicker">Seguranca</span>
              <h2>RECUPERAR SENHA</h2>
              <input
                value={resetForm.login}
                onChange={(e) => setResetForm({ ...resetForm, login: e.target.value })}
                placeholder="Login"
                maxLength={customerFieldLimits.login}
              />
              <input
                type="email"
                value={resetForm.email}
                onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                placeholder="Email cadastrado"
                maxLength={customerFieldLimits.email}
              />
              <button onClick={requestCustomerPasswordReset}>Solicitar recuperacao</button>
              <small>
                O email precisa ser o mesmo do cadastro. O link de troca sera enviado para esse
                email.
              </small>
            </div>
          )}

          {showTokenPasswordReset && (
            <div className="customer-app__panel">
              <span className="customer-app__panel-kicker">Recuperacao</span>
              <h2>NOVA SENHA</h2>
              <input
                type="password"
                value={tokenResetForm.password}
                onChange={(e) =>
                  setTokenResetForm({ ...tokenResetForm, password: e.target.value })
                }
                placeholder="Nova senha"
                maxLength={customerFieldLimits.password}
              />
              <input
                type="password"
                value={tokenResetForm.confirmPassword}
                onChange={(e) =>
                  setTokenResetForm({ ...tokenResetForm, confirmPassword: e.target.value })
                }
                placeholder="Confirmar nova senha"
                maxLength={customerFieldLimits.password}
              />
              <button onClick={resetCustomerPasswordWithToken}>Salvar nova senha</button>
              <small>Este link de seguranca vence automaticamente.</small>
            </div>
          )}

          <div className="customer-app__panel">
            <span className="customer-app__panel-kicker">Primeiro acesso</span>
            <h2>NOVO CADASTRO</h2>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              placeholder="Nome"
              maxLength={customerFieldLimits.name}
            />
            <input
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              placeholder="Criar login"
              maxLength={customerFieldLimits.login}
            />
            <div className="customer-app__password-field">
              <input
                type={showRegisterPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Criar senha"
                maxLength={customerFieldLimits.password}
              />
              <button
                type="button"
                onClick={() => setShowRegisterPassword((current) => !current)}
              >
                {showRegisterPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              placeholder="Telefone"
              inputMode="numeric"
              maxLength={customerFieldLimits.phone}
            />
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value.toUpperCase() })}
              placeholder="Cargo"
              maxLength={customerFieldLimits.position}
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              maxLength={customerFieldLimits.email}
            />
            <input
              type="email"
              value={form.emailConfirmation}
              onChange={(e) => setForm({ ...form, emailConfirmation: e.target.value })}
              placeholder="Confirmar email"
              maxLength={customerFieldLimits.email}
            />
            <button onClick={registerCustomer}>Enviar cadastro</button>
            <small>
              O cafe confirma o cadastro no sistema. Depois disso o app libera os pedidos.
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
              <span>
                Vencimento: {new Date(`${nextDueDate}T00:00:00`).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div>
              <strong>{currencyFormatter.format(availableCredit)}</strong>
              <span>saldo disponivel</span>
              <span>Limite: {currencyFormatter.format(creditLimit)}</span>
              <button
                type="button"
                className="customer-app__refresh-balance"
                onClick={() => loadPending(customer.phone)}
              >
                Atualizar saldo
              </button>
            </div>
          </section>

          {dueWarning && (
            <div className="customer-app__warning">
              Sua conta fecha em ate 5 dias. Pagamento somente Pix ou dinheiro.
            </div>
          )}

          {isBlockedByDebt && (
            <div className="customer-app__blocked">
              Conta bloqueada por atraso superior a 3 dias. Procure o cafe para regularizar.
            </div>
          )}

          {pendingPayments.length > 0 && (
            <section className="customer-app__pending-list">
              <div className="customer-app__pending-heading">
                <h2>Compras em aberto</h2>
                <strong>{currencyFormatter.format(pendingTotal)}</strong>
              </div>
              {pendingPayments.map((payment) => (
                <article key={payment.id} className="customer-app__pending-card">
                  <div>
                    <strong>{currencyFormatter.format(Number(payment.total_amount || 0))}</strong>
                    <span>
                      Compra: {new Date(`${payment.purchase_date}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <span>
                      Vencimento: {new Date(`${payment.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p>{payment.items_detail || payment.description || 'Compra lancada no caixa.'}</p>
                </article>
              ))}
            </section>
          )}

          <main className="customer-app__layout">
            <aside className="customer-app__cart">
              <div className="customer-app__cart-heading">
                <div>
                  <span>Seu pedido</span>
                  <h2>{currencyFormatter.format(total)}</h2>
                </div>
                <strong>{cart.length} item(ns)</strong>
              </div>
              {cart.length === 0 ? (
                <p>Nenhum item ainda.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="customer-app__cart-item">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <strong>{currencyFormatter.format(item.quantity * item.unit_price)}</strong>
                    <button onClick={() => removeFromCart(item.id)}>Remover</button>
                  </div>
                ))
              )}
              {customer && (
                <p>
                  Saldo depois deste pedido: {currencyFormatter.format(availableAfterCart)}
                </p>
              )}
              <p>Pagamento: pagar depois, Pix ou dinheiro no dia combinado.</p>
              <button
                onClick={sendOrder}
                disabled={
                  customer.status !== 'ativo' ||
                  isBlockedByDebt ||
                  (creditLimit > 0 && total > availableCredit)
                }
              >
                Enviar pedido
              </button>
            </aside>

            <section className="customer-app__menu">
              <div className="customer-app__section customer-app__search">
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Pesquisar produto"
                />
                <div className="customer-app__tabs" role="tablist" aria-label="Categorias do cardapio">
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
              </div>

              {dailyLunch && activeMenuTab === 'comidas' && (
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
                <div className="customer-app__section-heading">
                  <h2>{menuTabs.find((tab) => tab.id === activeMenuTab)?.label}</h2>
                  <span>{visibleProducts.length} produto(s)</span>
                </div>
                <div className="customer-app__grid">
                  {visibleProducts.map((product) => (
                    <MenuItem key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
                {visibleProducts.length === 0 && (
                  <p className="customer-app__empty">Nenhum produto encontrado nesta aba.</p>
                )}
              </div>
            </section>
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
        <div className={`customer-app__fallback ${getProductGroup(product)}`}>
          {getProductGroup(product) === 'bebidas'
            ? 'Bebida'
            : getProductGroup(product) === 'presentes'
              ? 'Presente'
              : 'Dr. Cafe'}
        </div>
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
