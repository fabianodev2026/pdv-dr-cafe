import { createRouter, createWebHistory } from 'vue-router'
import ProductManager from '../components/ProductManager.vue'
import TableManager from '../components/TableManager.vue'
import PendingPayments from '../components/PendingPayments.vue'
import FinanceManager from '../components/FinanceManager.vue'
import SettingsManager from '../components/SettingsManager.vue' // 1. Importa a tela

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', redirect: '/products' },
    { path: '/products', name: 'products', component: ProductManager },
    { path: '/tables', name: 'tables', component: TableManager },
    { path: '/pending', name: 'pending', component: PendingPayments },
    { path: '/finance', name: 'finance', component: FinanceManager },
    { path: '/settings', name: 'settings', component: SettingsManager }, // 2. Adiciona a rota
  ],
})

export default router
