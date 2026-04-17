<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'

const activeTab = ref('usuarios')

// --- LÓGICA FINANCEIRA (NOVA) ---
const allSales = ref([])
const isLoadingSales = ref(false)

const fetchFinanceData = async () => {
  isLoadingSales.value = true
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    allSales.value = data || []
  } catch (err) {
    console.error('Erro ao buscar financeiro:', err.message)
  } finally {
    isLoadingSales.value = false
  }
}

// Cálculos Automáticos (Computed)
const balance = computed(() => {
  const now = new Date()
  const todayStr = now.toLocaleDateString('pt-BR')
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let totalDay = 0
  let totalMonth = 0
  let totalYear = 0

  allSales.value.forEach((sale) => {
    const saleDate = new Date(sale.created_at)
    const amount = sale.total_amount

    // Soma Dia
    if (saleDate.toLocaleDateString('pt-BR') === todayStr) {
      totalDay += amount
    }

    // Soma Mês
    if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
      totalMonth += amount
    }

    // Soma Ano
    if (saleDate.getFullYear() === currentYear) {
      totalYear += amount
    }
  })

  return { totalDay, totalMonth, totalYear }
})

// --- LÓGICA DE USUÁRIOS (MANTIDA) ---
const users = ref([])
const newUser = ref({ username: '', password: '', role: 'caixa' })

const fetchUsers = async () => {
  const { data } = await supabase.from('pdv_users').select('*').order('username')
  if (data) users.value = data
}

const saveUser = async () => {
  if (!newUser.value.username || !newUser.value.password) return
  await supabase.from('pdv_users').insert([newUser.value])
  newUser.value = { username: '', password: '', role: 'caixa' }
  fetchUsers()
}

onMounted(() => {
  fetchUsers()
  fetchFinanceData()
})
</script>

<template>
  <div class="config-manager">
    <header class="header">
      <h1 class="title">⚙️ Painel de Controle Dr. Café</h1>
    </header>

    <div class="tabs">
      <button :class="{ active: activeTab === 'financeiro' }" @click="activeTab = 'financeiro'">
        📊 Balanço Financeiro
      </button>
      <button :class="{ active: activeTab === 'usuarios' }" @click="activeTab = 'usuarios'">
        👤 Usuários
      </button>
    </div>

    <section v-if="activeTab === 'financeiro'" class="glass-panel">
      <div class="finance-grid">
        <div class="balance-card">
          <span class="card-label">Vendas de Hoje</span>
          <h2 class="card-value">R$ {{ balance.totalDay.toFixed(2) }}</h2>
        </div>
        <div class="balance-card highlighted">
          <span class="card-label">Total do Mês</span>
          <h2 class="card-value">R$ {{ balance.totalMonth.toFixed(2) }}</h2>
        </div>
        <div class="balance-card">
          <span class="card-label">Faturamento Anual</span>
          <h2 class="card-value">R$ {{ balance.totalYear.toFixed(2) }}</h2>
        </div>
      </div>

      <div class="history-section">
        <h3>📜 Últimos Recebimentos</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Mesa</th>
              <th>Caixa</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sale in allSales.slice(0, 10)" :key="sale.id">
              <td>{{ new Date(sale.created_at).toLocaleString('pt-BR') }}</td>
              <td>Mesa {{ sale.table_number }}</td>
              <td>{{ sale.cashier_name }}</td>
              <td class="price-text">R$ {{ sale.total_amount.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="allSales.length === 0">Nenhuma venda registrada ainda.</p>
      </div>
    </section>

    <section v-if="activeTab === 'usuarios'" class="glass-panel">
      <h2>Gestão de Equipe</h2>
    </section>
  </div>
</template>

<style scoped>
.config-manager {
  color: var(--coffee-dark);
  padding: 20px;
}
.header {
  border-bottom: 2px solid var(--accent);
  margin-bottom: 20px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.tabs button {
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--coffee-light);
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: 0.3s;
}
.tabs button.active {
  background: var(--coffee-dark);
  color: white;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 25px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Grid Financeiro */
.finance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}
.balance-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(58, 38, 24, 0.1);
  border-bottom: 5px solid var(--coffee-light);
}
.balance-card.highlighted {
  border-bottom-color: var(--accent);
  transform: scale(1.05);
}
.card-label {
  font-size: 0.9em;
  color: var(--coffee-medium);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.card-value {
  margin: 10px 0 0 0;
  font-size: 1.8em;
  color: var(--coffee-dark);
}

.price-text {
  font-weight: bold;
  color: #2e7d32;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}
.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.data-table th {
  color: var(--coffee-medium);
  font-size: 0.9em;
}

@media (max-width: 768px) {
  .finance-grid {
    grid-template-columns: 1fr;
  }
}
</style>
