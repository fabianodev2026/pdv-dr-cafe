<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const roomOrders = ref([])
const isLoading = ref(true)

// Busca as vendas no banco de dados
const fetchRoomOrders = async () => {
  isLoading.value = true
  try {
    // Puxa as últimas 50 vendas do dia
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // O TRUQUE: Filtra a lista para mostrar APENAS vendas que têm o "customer_name" preenchido (Quartos)
    if (data) {
      roomOrders.value = data.filter(
        (sale) => sale.customer_name && sale.customer_name.trim() !== '',
      )
    }
  } catch (err) {
    console.error('Erro ao buscar pedidos dos quartos:', err.message)
  } finally {
    isLoading.value = false
  }
}

// Atualiza o painel a cada 30 segundos automaticamente!
let interval
onMounted(() => {
  fetchRoomOrders()
  interval = setInterval(fetchRoomOrders, 30000)
})
</script>

<template>
  <div class="room-panel-container">
    <header class="header">
      <h1 class="title">🏥 Painel de Expedição - Quartos</h1>
      <button @click="fetchRoomOrders" class="btn-refresh">🔄 Atualizar Agora</button>
    </header>

    <div v-if="isLoading && roomOrders.length === 0" class="loading">Buscando pedidos...</div>

    <div v-else-if="roomOrders.length === 0" class="empty-state">
      Nenhum pedido de quarto registrado recentemente.
    </div>

    <div v-else class="orders-grid">
      <div v-for="order in roomOrders" :key="order.id" class="order-card glass-panel">
        <div class="order-header">
          <h2>Quarto {{ order.table_number }}</h2>
          <span class="time">{{
            new Date(order.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          }}</span>
        </div>

        <div class="patient-info">
          <p><strong>👤 Paciente:</strong> {{ order.customer_name }}</p>
          <p v-if="order.customer_phone">
            <strong>📞 Tel/Ramal:</strong> {{ order.customer_phone }}
          </p>
        </div>

        <hr class="divider" />

        <ul class="items-list">
          <li v-for="item in order.items" :key="item.id">
            <span class="qty">{{ item.quantity }}x</span> {{ item.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-panel-container {
  color: var(--coffee-dark);
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--accent);
  margin-bottom: 30px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  margin: 0;
}
.btn-refresh {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--coffee-dark);
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  color: var(--coffee-dark);
  transition: 0.3s;
}
.btn-refresh:hover {
  background: var(--coffee-dark);
  color: white;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(107, 76, 58, 0.2);
  box-shadow: 0 8px 32px rgba(58, 38, 24, 0.1);
  border-top: 5px solid var(--accent);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.order-header h2 {
  margin: 0;
  color: #d32f2f;
  font-size: 1.8em;
}
.time {
  background: var(--coffee-light);
  color: var(--coffee-dark);
  padding: 5px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.9em;
}

.patient-info p {
  margin: 5px 0;
  font-size: 0.95em;
  color: var(--coffee-medium);
}

.divider {
  border: none;
  border-top: 1px dashed var(--coffee-light);
  margin: 15px 0;
}

.items-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.items-list li {
  margin-bottom: 8px;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--coffee-dark);
  display: flex;
  align-items: center;
  gap: 10px;
}
.qty {
  background: var(--coffee-dark);
  color: white;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.9em;
}

.empty-state,
.loading {
  text-align: center;
  font-size: 1.2em;
  color: var(--coffee-medium);
  margin-top: 50px;
  font-style: italic;
}
</style>
