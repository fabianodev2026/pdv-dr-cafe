import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // Importa o nosso roteador

const app = createApp(App)

app.use(router) // Ensina o aplicativo a usar as rotas

app.mount('#app')
