<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const props = defineProps({ currentUser: Object })

const viewMode = ref('salon')
const tables = ref([
  {
    id: 1,
    number: 1,
    type: 'table',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
  {
    id: 2,
    number: 2,
    type: 'table',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
  {
    id: 3,
    number: 3,
    type: 'table',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
  {
    id: 4,
    number: 4,
    type: 'table',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
])
const rooms = ref([
  {
    id: 101,
    number: 101,
    type: 'room',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
  {
    id: 102,
    number: 102,
    type: 'room',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
  {
    id: 201,
    number: 201,
    type: 'room',
    status: 'Livre',
    total: 0,
    items: [],
    customer_name: '',
    customer_phone: '',
  },
])

const activeItem = ref(null)
const availableProducts = ref([])
const showReceipt = ref(false)
const receiptData = ref(null)

const fetchProducts = async () => {
  const { data } = await supabase.from('products').select('*').order('name')
  if (data) availableProducts.value = data
}

onMounted(fetchProducts)

const openItem = (item) => {
  activeItem.value = item
  if (item.status === 'Livre') item.status = 'Ocupada'
}

const closeItem = () => {
  activeItem.value = null
}

// NOVA LÓGICA DE CLIQUE NA FOTO
const addProductToTable = (product) => {
  activeItem.value.items.push({
    id: Date.now(),
    name: product.name,
    price: product.unit_price,
    quantity: 1,
    total: product.unit_price,
  })
  updateTotal()
}

const removeItem = (itemId) => {
  activeItem.value.items = activeItem.value.items.filter((item) => item.id !== itemId)
  updateTotal()
}

const updateTotal = () => {
  activeItem.value.total = activeItem.value.items.reduce((s, i) => s + i.total, 0)
}

const payCommand = () => {
  receiptData.value = {
    type: activeItem.value.type,
    number: activeItem.value.number,
    items: [...activeItem.value.items],
    total: activeItem.value.total,
    customer_name: activeItem.value.customer_name,
    customer_phone: activeItem.value.customer_phone,
    date: new Date().toLocaleString('pt-BR'),
  }
  showReceipt.value = true
}

const printReceipt = () => {
  window.print()
}

const finalizePayment = async () => {
  try {
    const { error } = await supabase.from('sales').insert([
      {
        table_number: receiptData.value.number,
        total_amount: receiptData.value.total,
        cashier_name: props.currentUser?.username || 'Desconhecido',
        customer_name: receiptData.value.customer_name,
        customer_phone: receiptData.value.customer_phone,
        items: receiptData.value.items,
      },
    ])
    if (error) throw error

    activeItem.value.items = []
    activeItem.value.total = 0
    activeItem.value.status = 'Livre'
    activeItem.value.customer_name = ''
    activeItem.value.customer_phone = ''
    activeItem.value = null
    showReceipt.value = false
    alert('Venda registrada com sucesso no cofre!')
  } catch (err) {
    alert('Erro ao salvar no cofre: ' + err.message)
  }
}
</script>

<template>
  <div class="pdv-container">
    <div v-if="!activeItem" class="mode-selector no-print">
      <button :class="{ active: viewMode === 'salon' }" @click="viewMode = 'salon'">
        ☕ Salão (Mesas)
      </button>
      <button :class="{ active: viewMode === 'hospital' }" @click="viewMode = 'hospital'">
        🏥 Hospital (Quartos)
      </button>
    </div>

    <div v-if="!activeItem" class="grid-view no-print">
      <div class="cards-grid">
        <div
          v-for="item in viewMode === 'salon' ? tables : rooms"
          :key="item.id"
          class="item-card"
          :class="item.status === 'Livre' ? 'free' : 'occupied'"
          @click="openItem(item)"
        >
          <h3>{{ viewMode === 'salon' ? 'Mesa' : 'Quarto' }} {{ item.number }}</h3>
          <p class="status">{{ item.status }}</p>
          <p v-if="item.customer_name" class="customer-info">👤 {{ item.customer_name }}</p>
          <p v-if="item.status === 'Ocupada'" class="total-tag">R$ {{ item.total.toFixed(2) }}</p>
        </div>
      </div>
    </div>

    <div v-else class="command-view no-print">
      <header class="command-header">
        <button @click="closeItem" class="btn-back">⬅ Voltar</button>
        <h2>{{ activeItem.type === 'table' ? 'Mesa' : 'Quarto' }} {{ activeItem.number }}</h2>
        <div class="total-badge">R$ {{ activeItem.total.toFixed(2) }}</div>
      </header>

      <div class="split-layout">
        <div class="products-showcase glass-panel">
          <h3>📦 Toque para Adicionar</h3>

          <div class="visual-menu">
            <div
              v-for="product in availableProducts"
              :key="product.id"
              class="product-item-card"
              @click="addProductToTable(product)"
            >
              <div class="img-wrapper">
                <img v-if="product.image_url" :src="product.image_url" alt="Foto" />
                <div v-else class="no-img-placeholder">☕</div>
              </div>
              <div class="product-info-mini">
                <span class="p-name">{{ product.name }}</span>
                <span class="p-price">R$ {{ product.unit_price.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="active-command-panel">
          <div v-if="activeItem.type === 'room'" class="glass-panel hospital-fields">
            <input
              type="text"
              v-model="activeItem.customer_name"
              placeholder="👤 Nome do Paciente/Acompanhante"
            />
            <input
              type="text"
              v-model="activeItem.customer_phone"
              placeholder="📞 Ramal ou Telefone"
            />
          </div>

          <div class="glass-panel items-list-panel">
            <h3>📝 Itens na Comanda</h3>
            <p v-if="activeItem.items.length === 0" class="empty-state">
              Toque em um produto ao lado para adicionar.
            </p>

            <div v-else class="mobile-items-list">
              <div v-for="item in activeItem.items" :key="item.id" class="mobile-item">
                <div class="item-details">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-price">R$ {{ item.price.toFixed(2) }}</span>
                </div>
                <button @click="removeItem(item.id)" class="btn-remove-item">❌</button>
              </div>
            </div>

            <button
              v-if="activeItem.items.length > 0 && props.currentUser?.role !== 'garcom'"
              @click="payCommand"
              class="btn-pay"
            >
              💳 Encerrar e Pagar
            </button>
            <p v-if="props.currentUser?.role === 'garcom'" class="garcom-aviso">
              Apenas o Caixa pode finalizar o pagamento.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showReceipt" class="receipt-modal-overlay no-print">
      <div class="receipt-modal-content">
        <h2>Pagamento Pronto!</h2>
        <div class="modal-actions">
          <button @click="printReceipt" class="btn-print">🖨️ Imprimir Recibo</button>
          <button @click="finalizePayment" class="btn-close-receipt">Confirmar no Sistema</button>
        </div>
      </div>
    </div>
    <div v-if="showReceipt" class="printable-receipt">
      <div class="receipt-header">
        <h2>☕ DR. CAFÉ</h2>
        <p><strong>CUPOM NÃO FISCAL</strong></p>
        <p>{{ activeItem.type === 'table' ? 'Mesa' : 'Quarto' }}: {{ receiptData.number }}</p>
        <hr />
      </div>
      <table class="receipt-table">
        <tr>
          <th>Qtd</th>
          <th>Item</th>
          <th>Total</th>
        </tr>
        <tr v-for="item in receiptData.items" :key="item.id">
          <td>{{ item.quantity }}</td>
          <td>{{ item.name }}</td>
          <td>{{ item.total.toFixed(2) }}</td>
        </tr>
      </table>
      <div class="receipt-footer">
        <hr />
        <h3>TOTAL: R$ {{ receiptData.total.toFixed(2) }}</h3>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ESTILOS GERAIS */
.mode-selector {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}
.mode-selector button {
  padding: 12px 25px;
  border-radius: 30px;
  border: 2px solid var(--coffee-dark);
  font-weight: bold;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.6);
  color: var(--coffee-dark);
  transition: 0.3s;
}
.mode-selector button.active {
  background: var(--coffee-dark);
  color: white;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 15px;
}
.item-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(5px);
  padding: 20px;
  border-radius: 15px;
  text-align: center;
  cursor: pointer;
  border-bottom: 5px solid var(--coffee-light);
  transition: 0.2s;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}
.item-card.occupied {
  border-bottom-color: var(--accent);
  background: #efe8dd;
}
.item-card h3 {
  margin: 0 0 10px 0;
  font-size: 1.5em;
}
.status {
  font-weight: bold;
  margin-bottom: 5px;
}
.occupied .status {
  color: #d32f2f;
}
.customer-info {
  font-size: 0.85em;
  color: var(--coffee-medium);
  margin: 5px 0;
  font-weight: bold;
}
.total-tag {
  font-size: 1.2em;
  color: var(--accent);
  font-weight: bold;
  margin-top: 10px;
}

.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.btn-back {
  background: var(--coffee-medium);
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}
.total-badge {
  background: #2e7d32;
  color: white;
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.2em;
}
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 15px;
  margin-bottom: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

/* LAYOUT SPLIT (Vitrine de um lado, Comanda do outro) */
.split-layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
}
@media (max-width: 900px) {
  .split-layout {
    grid-template-columns: 1fr;
  }
}

/* A NOVA VITRINE VISUAL DE PRODUTOS */
.visual-menu {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 15px;
  margin-top: 15px;
}
.product-item-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  border: 1px solid var(--coffee-light);
}
.product-item-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(107, 76, 58, 0.15);
  border-color: var(--accent);
}
.img-wrapper {
  height: 100px;
  width: 100%;
  background: var(--bg-sepia);
  display: flex;
  align-items: center;
  justify-content: center;
}
.img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.no-img-placeholder {
  font-size: 3em;
  color: var(--coffee-medium);
  opacity: 0.5;
}
.product-info-mini {
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.p-name {
  font-weight: 600;
  font-size: 0.9em;
  margin-bottom: 5px;
  color: var(--coffee-dark);
  line-height: 1.2;
}
.p-price {
  color: #2e7d32;
  font-weight: bold;
  font-size: 0.9em;
  background: #eefeeb;
  padding: 2px 8px;
  border-radius: 10px;
}

.hospital-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hospital-fields input {
  padding: 12px;
  border: 1px solid var(--coffee-light);
  border-radius: 8px;
  font-family: 'Poppins', sans-serif;
}

.mobile-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mobile-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid var(--accent);
}
.item-details {
  display: flex;
  flex-direction: column;
}
.item-name {
  font-weight: bold;
  font-size: 1em;
}
.item-price {
  color: #2e7d32;
  font-size: 0.9em;
  margin-top: 3px;
}
.btn-remove-item {
  background: transparent;
  border: none;
  color: #c62828;
  font-size: 1.2em;
  cursor: pointer;
  padding: 5px;
}

.btn-pay {
  background: #2e7d32;
  color: white;
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 12px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  box-shadow: 0 4px 10px rgba(46, 125, 50, 0.3);
  transition: 0.3s;
}
.btn-pay:hover {
  background: #1b5e20;
}
.garcom-aviso {
  text-align: center;
  color: #d32f2f;
  font-weight: bold;
  background: #ffebee;
  padding: 10px;
  border-radius: 8px;
  margin-top: 20px;
}

/* RECIBO */
.receipt-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.receipt-modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
}
.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.btn-print {
  background: var(--coffee-dark);
  color: white;
  border: none;
  padding: 15px;
  border-radius: 8px;
  font-size: 1.1em;
  cursor: pointer;
}
.btn-close-receipt {
  background: #f5f5f5;
  border: 1px solid #ccc;
  padding: 15px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}

@media print {
  @page {
    margin: 0;
    size: 80mm auto;
  }
  .no-print {
    display: none !important;
  }
  html,
  body,
  .pdv-container {
    height: auto !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white;
  }
  .printable-receipt {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    padding: 5px;
    width: 80mm !important;
    margin: 0;
  }
  .receipt-header,
  .receipt-footer {
    text-align: center;
  }
  .receipt-table {
    width: 100%;
    text-align: left;
    border-collapse: collapse;
    margin: 10px 0;
  }
  .receipt-table th {
    border-bottom: 1px dashed black;
  }
  hr {
    border-top: 1px dashed black;
  }
}
</style>
