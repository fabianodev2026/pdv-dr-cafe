<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import LoginScreen from './components/LoginScreen.vue'

const router = useRouter()

// Variável que guarda quem está logado no momento. Se for null, o sistema trava.
const currentUser = ref(null)

// Função disparada quando a LoginScreen diz que a senha está certa
const handleLoginSuccess = (userData) => {
  currentUser.value = userData
  router.push('/') // Força a voltar para o salão de mesas ao logar
}

// Função para sair do sistema
const handleLogout = () => {
  currentUser.value = null
  router.push('/')
}
</script>

<template>
  <LoginScreen v-if="!currentUser" @login-success="handleLoginSuccess" />

  <div v-else class="app-container">
    <header class="main-header no-print">
      <RouterLink to="/" class="logo-link">
        <div class="logo-container">
          <img src="@/assets/logo.jpeg" alt="Logo Dr. Café" class="logo-img" />
        </div>
      </RouterLink>

      <nav class="main-nav">
        <RouterLink to="/" class="nav-link">
          <span class="material-symbols-outlined">table_restaurant</span> Mesas
        </RouterLink>
        <RouterLink to="/painel-quartos" class="nav-link">
          <span class="material-symbols-outlined">clinical_notes</span> Painel
        </RouterLink>
        <RouterLink v-if="currentUser.role !== 'garcom'" to="/produtos" class="nav-link">
          <span class="material-symbols-outlined">inventory_2</span> Produtos
        </RouterLink>
        <RouterLink v-if="currentUser.role === 'admin'" to="/configuracoes" class="nav-link">
          <span class="material-symbols-outlined">settings</span> Configs
        </RouterLink>
      </nav>

      <div class="user-badge">
        <span class="user-greeting"
          >Olá, <strong>{{ currentUser.username }}</strong>
          <span class="role-tag">({{ currentUser.role }})</span></span
        >
        <button @click="handleLogout" class="btn-logout">Sair 🚪</button>
      </div>
    </header>

    <main class="main-content">
      <RouterView :currentUser="currentUser" />
    </main>
  </div>
</template>

<style>
/* ... TODO O SEU CSS GLOBAL CONTINUA EXATAMENTE IGUAL ... */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,600&family=Poppins:wght@300;400;600&display=swap');

:root {
  --bg-sepia: #f4eee6;
  --coffee-dark: #3a2618;
  --coffee-medium: #6b4c3a;
  --coffee-light: #d8c8b8;
  --accent: #8b5e3c;
}

body {
  background-color: var(--bg-sepia);
  font-family: 'Poppins', sans-serif;
  margin: 0;
  padding: 0;
  color: var(--coffee-dark);
}
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-header {
  background-color: var(--coffee-dark);
  padding: 15px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  border-bottom: 4px solid var(--accent);
  gap: 15px;
  position: relative; /* Para podermos posicionar o botão de sair no canto */
}

.logo-link {
  text-decoration: none;
  transition: transform 0.3s;
  display: inline-block;
}
.logo-link:hover {
  transform: scale(1.05);
}
.logo-container {
  background-color: var(--bg-sepia);
  padding: 8px;
  border-radius: 50%;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.logo-img {
  height: 90px;
  width: 90px;
  object-fit: contain;
  border-radius: 50%;
}

.main-nav {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}
.nav-link {
  color: var(--bg-sepia);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  padding: 8px 15px;
  border-radius: 20px;
  transition: all 0.3s;
}
.nav-link:hover,
.nav-link.router-link-active {
  background-color: var(--accent);
  color: white;
}

/* Novo Estilo do Usuário no Topo */
.user-badge {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 15px;
  border-radius: 20px;
  margin-top: 5px;
}
.user-greeting {
  color: var(--bg-sepia);
  font-size: 0.9em;
}
.role-tag {
  font-size: 0.8em;
  opacity: 0.7;
  text-transform: capitalize;
}
.btn-logout {
  background: var(--accent);
  color: white;
  border: none;
  padding: 5px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: bold;
  font-family: 'Poppins', sans-serif;
  transition: 0.2s;
}
.btn-logout:hover {
  background: #d32f2f;
}

.main-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

@media print {
  .no-print {
    display: none !important;
  }
  body {
    background-color: white;
  }
}
</style>
