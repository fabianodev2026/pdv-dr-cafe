<script setup>
import { ref, computed } from 'vue'

// Dados simulados de transações (no futuro, virão do Supabase)
const transactions = ref([
  { id: 1, date: '2026-04-10', description: 'Vendas do dia', type: 'receita', amount: 450.5 },
  { id: 2, date: '2026-04-11', description: 'Vendas do dia', type: 'receita', amount: 520.0 },
  { id: 3, date: '2026-04-12', description: 'Fornecedor de Grãos', type: 'despesa', amount: 200.0 },
  { id: 4, date: '2026-04-13', description: 'Conta de Luz', type: 'despesa', amount: 150.0 },
  { id: 5, date: '2026-04-14', description: 'Vendas do dia', type: 'receita', amount: 610.25 },
])

// Cálculos automáticos usando 'computed'
const totalReceitas = computed(() => {
  return transactions.value
    .filter((t) => t.type === 'receita')
    .reduce((acc, curr) => acc + curr.amount, 0)
})

const totalDespesas = computed(() => {
  return transactions.value
    .filter((t) => t.type === 'despesa')
    .reduce((acc, curr) => acc + curr.amount, 0)
})

const saldoAtual = computed(() => {
  return totalReceitas.value - totalDespesas.value
})
</script>

<template>
  <div class="finance-manager">
    <header class="header">
      <h1 class="title">Balanço Financeiro</h1>
    </header>

    <section class="summary-cards">
      <div class="card income">
        <h3>Receitas (Mês)</h3>
        <p class="amount">R$ {{ totalReceitas.toFixed(2) }}</p>
      </div>
      <div class="card expense">
        <h3>Despesas (Mês)</h3>
        <p class="amount">R$ {{ totalDespesas.toFixed(2) }}</p>
      </div>
      <div class="card balance" :class="{ positive: saldoAtual >= 0, negative: saldoAtual < 0 }">
        <h3>Saldo Líquido</h3>
        <p class="amount">R$ {{ saldoAtual.toFixed(2) }}</p>
      </div>
    </section>

    <section class="transaction-list">
      <h2>Histórico de Transações</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Tipo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in transactions" :key="item.id">
            <td>{{ item.date }}</td>
            <td>{{ item.description }}</td>
            <td>
              <span class="badge" :class="item.type">
                {{ item.type === 'receita' ? 'Receita' : 'Despesa' }}
              </span>
            </td>
            <td class="amount-cell" :class="item.type">
              {{ item.type === 'receita' ? '+' : '-' }} R$ {{ item.amount.toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.finance-manager {
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

/* Estilos dos Cartões de Resumo */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
  border-top: 5px solid #d7ccc8;
}

.card h3 {
  margin-top: 0;
  color: #795548;
  font-weight: 400;
}
.card .amount {
  font-size: 2em;
  font-weight: bold;
  margin: 10px 0 0 0;
}

.card.income {
  border-top-color: #81c784;
}
.card.income .amount {
  color: #2e7d32;
}

.card.expense {
  border-top-color: #e57373;
}
.card.expense .amount {
  color: #c62828;
}

.card.balance.positive {
  border-top-color: #4fc3f7;
}
.card.balance.positive .amount {
  color: #0277bd;
}
.card.balance.negative {
  border-top-color: #e57373;
}

/* Estilos da Tabela */
.transaction-list {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}
.transaction-list h2 {
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  padding-bottom: 10px;
  margin-bottom: 20px;
  font-weight: 400;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
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

.badge {
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
  text-transform: uppercase;
}
.badge.receita {
  background-color: #e8f5e9;
  color: #2e7d32;
}
.badge.despesa {
  background-color: #ffebee;
  color: #c62828;
}

.amount-cell {
  font-weight: bold;
}
.amount-cell.receita {
  color: #2e7d32;
}
.amount-cell.despesa {
  color: #c62828;
}
</style>
