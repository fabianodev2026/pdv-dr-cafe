<script setup>
import { ref, computed } from 'vue' // 1. Importamos o 'computed'

// Lista temporária
const pendingList = ref([
  {
    id: 1,
    customerName: 'João Silva',
    productName: 'Café Expresso + Pão de Queijo',
    quantity: 1,
    unitPrice: 12.5,
    totalAmount: 25.0,
    purchaseDate: '2026-04-14',
    dueDate: '2026-04-20',
    status: 'Pendente',
  },
])

// 2. Adicionamos o campo 'quantity' (quantidade) com o valor inicial de 1
const newPending = ref({
  customerName: '',
  productName: '',
  quantity: 1,
  unitPrice: 0,
  purchaseDate: '',
  dueDate: '',
})

// 3. A MÁGICA: Criamos uma variável que se calcula sozinha!
const calculatedTotal = computed(() => {
  return newPending.value.quantity * newPending.value.unitPrice
})

const addPending = () => {
  pendingList.value.push({
    id: Date.now(),
    ...newPending.value,
    totalAmount: calculatedTotal.value, // Salvamos o resultado da matemática na lista
    status: 'Pendente',
  })
  // Limpa o formulário após salvar (voltando a quantidade para 1)
  newPending.value = {
    customerName: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    purchaseDate: '',
    dueDate: '',
  }
}
</script>

<template>
  <div class="pending-payments">
    <header class="header">
      <h1 class="title">Contas a Receber (Vai Pagar)</h1>
    </header>

    <section class="add-form">
      <h2>Nova Conta</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Nome do Cliente</label>
          <input type="text" v-model="newPending.customerName" placeholder="Ex: Maria" required />
        </div>
        <div class="form-group">
          <label>Produto(s)</label>
          <input
            type="text"
            v-model="newPending.productName"
            placeholder="Ex: Cappuccino"
            required
          />
        </div>
        <div class="form-group">
          <label>Data da Compra</label>
          <input type="date" v-model="newPending.purchaseDate" required />
        </div>
        <div class="form-group">
          <label>Data que vai pagar</label>
          <input type="date" v-model="newPending.dueDate" required />
        </div>

        <div class="form-group">
          <label>Quantidade</label>
          <input type="number" v-model="newPending.quantity" min="1" required />
        </div>
        <div class="form-group">
          <label>Valor Unitário (R$)</label>
          <input type="number" v-model="newPending.unitPrice" step="0.01" required />
        </div>
        <div class="form-group total-display">
          <label>Valor Total</label>
          <div class="calculated-value">R$ {{ calculatedTotal.toFixed(2) }}</div>
        </div>
      </div>
      <button @click="addPending" class="btn-primary">Registrar Conta</button>
    </section>

    <section class="list-section">
      <h2>Clientes Pendentes</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Produto(s)</th>
            <th>Qtd.</th>
            <th>Compra</th>
            <th>Vencimento</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in pendingList" :key="item.id">
            <td>{{ item.customerName }}</td>
            <td>{{ item.productName }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ item.purchaseDate }}</td>
            <td class="due-date">{{ item.dueDate }}</td>
            <td class="total">R$ {{ item.totalAmount.toFixed(2) }}</td>
            <td>
              <span class="badge pending">{{ item.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.pending-payments {
  color: #3e2723;
  background-color: #fafafa;
  padding: 20px;
}
.header {
  border-bottom: 2px solid #5d4037;
  margin-bottom: 30px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  text-align: center;
}

.add-form,
.list-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}
h2 {
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #d7ccc8;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1em;
}

/* Estilo especial para o campo do Total Calculado */
.total-display {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.calculated-value {
  background-color: #eefeeb;
  color: #2e7d32;
  padding: 10px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 1.1em;
  border: 1px solid #c8e6c9;
}

.btn-primary {
  background-color: #5d4037;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1em;
}
.btn-primary:hover {
  background-color: #3e2723;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #d7ccc8;
}
.data-table th {
  background-color: #f5f5f5;
  color: #5d4037;
}
.due-date {
  color: #c62828;
  font-weight: bold;
}
.total {
  font-weight: bold;
}
.badge {
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
}
.badge.pending {
  background-color: #ffe082;
  color: #ff8f00;
}
</style>
