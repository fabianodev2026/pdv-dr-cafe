import { createRouter, createWebHistory } from 'vue-router'
import TableManager from '../components/TableManager.vue'
import ProductManager from '../components/ProductManager.vue'
import ConfigManager from '../components/ConfigManager.vue'
import RoomPanel from '../components/RoomPanel.vue' // <-- 1. Importa a tela

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'mesas', component: TableManager },
    { path: '/produtos', name: 'produtos', component: ProductManager },
    { path: '/configuracoes', name: 'configuracoes', component: ConfigManager },
    { path: '/painel-quartos', name: 'painel-quartos', component: RoomPanel }, // <-- 2. Cria a rota
  ],
})

export default router
