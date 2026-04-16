<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase' // Conecta com o seu banco de dados

// Estado das mesas
const tables = ref([
  { id: 1, number: 1, status: 'Livre', total: 0, items: [] },
  { id: 2, number: 2, status: 'Livre', total: 0, items: [] },
  { id: 3, number: 3, status: 'Livre', total: 0, items: [] },
  { id: 4, number: 4, status: 'Livre', total: 0, items: [] },
])

const activeTable = ref(null)

// Lista de produtos que virá do Supabase
const availableProducts = ref([])

const selectedProduct = ref('')
const selectedQuantity = ref(1)

// Busca os produtos reais no banco de dados
const fetchProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('name')

    if (error) throw error
    if (data) availableProducts.value = data
  } catch (err) {
    console.error('Erro ao buscar produtos:', err.message)
  }
}

// Quando a tela abre, ele roda a busca
onMounted(() => {
  fetchProducts()
})

// --- FUNÇÕES DA MESA ---
const openTable = (table) => {
  activeTable.value = table
  if (table.status === 'Livre') {
    table.status = 'Ocupada'
  }
}

const closeTable = () => {
  activeTable.value = null
}

const addItem = () => {
  if (!selectedProduct.value || selectedQuantity.value < 1) return

  // Calcula o valor (preço unitário real do banco x quantidade)
  const itemTotal = selectedProduct.value.unit_price * selectedQuantity.value

  activeTable.value.items.push({
    id: Date.now(),
    name: selectedProduct.value.name,
    price: selectedProduct.value.unit_price,
    quantity: selectedQuantity.value,
    total: itemTotal,
  })

  updateTableTotal()
  selectedProduct.value = ''
  selectedQuantity.value = 1
}

const removeItem = (itemId) => {
  activeTable.value.items = activeTable.value.items.filter((item) => item.id !== itemId)
  updateTableTotal()
}

const updateTableTotal = () => {
  activeTable.value.total = activeTable.value.items.reduce((soma, item) => soma + item.total, 0)
  if (activeTable.value.items.length === 0) {
    activeTable.value.status = 'Livre'
  }
}

const payCommand = () => {
  alert(`Pagamento de R$ ${activeTable.value.total.toFixed(2)} recebido com sucesso!`)
  activeTable.value.items = []
  activeTable.value.total = 0
  activeTable.value.status = 'Livre'
  activeTable.value = null
}
</script>

<template>
  <div class="table-manager">
    <div v-if="!activeTable" class="salon-view">
      <header class="header">
        <h1 class="title">Salão - Mesas e Comandas</h1>
      </header>

      <div class="tables-grid">
        <div
          v-for="table in tables"
          :key="table.id"
          class="table-card"
          :class="table.status === 'Livre' ? 'free' : 'occupied'"
          @click="openTable(table)"
        >
          <h2>Mesa {{ table.number.toString().padStart(2, '0') }}</h2>
          <p class="status">{{ table.status }}</p>
          <p v-if="table.status === 'Ocupada'" class="total">R$ {{ table.total.toFixed(2) }}</p>
          <button class="btn-action">
            {{ table.status === 'Livre' ? 'Abrir Mesa' : 'Ver Comanda' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="command-view">
      <header class="header command-header">
        <div>
          <button @click="closeTable" class="btn-back">← Voltar pro Salão</button>
          <h1 class="title">Comanda: Mesa {{ activeTable.number.toString().padStart(2, '0') }}</h1>
        </div>
        <div class="command-total-display">Total: R$ {{ activeTable.total.toFixed(2) }}</div>
      </header>

      <div class="command-layout">
        <section class="add-item-panel">
          <h2>Adicionar Pedido</h2>
          <div class="form-group">
            <label>Selecione o Produto</label>
            <select v-model="selectedProduct">
              <option value="" disabled>Escolha um produto...</option>
              <option v-for="product in availableProducts" :key="product.id" :value="product">
                {{ product.name }} - R$ {{ product.unit_price.toFixed(2) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantidade</label>
            <input type="number" v-model="selectedQuantity" min="1" />
          </div>
          <button @click="addItem" class="btn-add">Adicionar à Comanda</button>
        </section>

        <section class="items-list-panel">
          <h2>Itens na Mesa</h2>
          <div v-if="activeTable.items.length === 0" class="empty-state">
            Nenhum produto adicionado ainda.
          </div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>Qtd</th>
                <th>Produto</th>
                <th>Total</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in activeTable.items" :key="item.id">
                <td>{{ item.quantity }}x</td>
                <td>{{ item.name }}</td>
                <td class="item-value">R$ {{ item.total.toFixed(2) }}</td>
                <td><button @click="removeItem(item.id)" class="btn-remove">X</button></td>
              </tr>
            </tbody>
          </table>

          <button v-if="activeTable.items.length > 0" @click="payCommand" class="btn-pay">
            Encerrar e Pagar
          </button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-manager {
  color: #3e2723;
  background-color: #fafafa;
  padding: 20px;
  min-height: 100vh;
}
.header {
  border-bottom: 2px solid #5d4037;
  margin-bottom: 30px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  margin: 0;
  color: #3e2723;
}

/* Salão */
.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.table-card {
  border: 2px solid #d7ccc8;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  background-color: white;
  cursor: pointer;
  transition: transform 0.2s;
}
.table-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}
.table-card h2 {
  margin: 0 0 10px 0;
  color: #3e2723;
  font-size: 1.8em;
}
.status {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 1.1em;
}

.free {
  border-top: 8px solid #81c784;
}
.free .status {
  color: #388e3c;
}

.occupied {
  border-top: 8px solid #e57373;
}
.occupied .status {
  color: #d32f2f;
}
.occupied .total {
  font-size: 1.3em;
  color: #5d4037;
  margin-bottom: 15px;
  font-weight: bold;
}

.btn-action {
  background-color: #5d4037;
  color: white;
  border: none;
  padding: 10px;
  width: 100%;
  border-radius: 4px;
  font-weight: bold;
  pointer-events: none;
}

/* Dentro da Comanda */
.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-back {
  background: none;
  border: none;
  color: #795548;
  cursor: pointer;
  font-weight: bold;
  font-size: 1em;
  padding: 0;
  margin-bottom: 5px;
}
.btn-back:hover {
  color: #3e2723;
  text-decoration: underline;
}
.command-total-display {
  background-color: #eefeeb;
  color: #2e7d32;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1.5em;
  font-weight: bold;
  border: 1px solid #c8e6c9;
}

.command-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
}
@media (max-width: 768px) {
  .command-layout {
    grid-template-columns: 1fr;
  }
}

.add-item-panel,
.items-list-panel {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}
.add-item-panel h2,
.items-list-panel h2 {
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  padding-bottom: 10px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 400;
}

.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: #3e2723;
}
.form-group select,
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #d7ccc8;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1em;
}

.btn-add {
  background-color: #5d4037;
  color: white;
  border: none;
  padding: 12px;
  width: 100%;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1em;
  margin-top: 10px;
}
.btn-add:hover {
  background-color: #3e2723;
}

.empty-state {
  text-align: center;
  color: #795548;
  font-style: italic;
  padding: 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th,
.data-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #d7ccc8;
  color: #3e2723;
}
.data-table th {
  background-color: #f5f5f5;
  color: #5d4037;
}
.item-value {
  font-weight: bold;
  color: #3e2723;
}

.btn-remove {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-weight: bold;
}
.btn-remove:hover {
  background-color: #ffcdd2;
}

.btn-pay {
  background-color: #388e3c;
  color: white;
  border: none;
  padding: 15px;
  width: 100%;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1.2em;
  margin-top: 20px;
}
.btn-pay:hover {
  background-color: #2e7d32;
}
</style>
