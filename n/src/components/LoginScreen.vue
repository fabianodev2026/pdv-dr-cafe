<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

// Avisa o sistema pai (App.vue) quando o login der certo
const emit = defineEmits(['login-success'])

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const fazerLogin = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = 'Preencha usuário e senha.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    // Vai no Supabase e procura exatamente esse usuário e senha
    const { data, error } = await supabase
      .from('pdv_users')
      .select('*')
      .eq('username', username.value)
      .eq('password', password.value)
      .single() // Pega apenas 1 resultado

    if (error || !data) {
      errorMessage.value = 'Usuário ou senha incorretos!'
      isLoading.value = false
      return
    }

    // Se achou, manda os dados do usuário para o App.vue destrancar o sistema!
    emit('login-success', data)
  } catch (err) {
    errorMessage.value = 'Erro ao conectar com o servidor.'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-glass-box">
      <img src="@/assets/logo.jpeg" alt="Logo Dr. Café" class="login-logo" />
      <h2>Acesso ao Sistema</h2>

      <div class="form-group">
        <label>Usuário</label>
        <input
          type="text"
          v-model="username"
          @keyup.enter="fazerLogin"
          placeholder="Digite seu login"
          autocomplete="off"
        />
      </div>

      <div class="form-group">
        <label>Senha</label>
        <input type="password" v-model="password" @keyup.enter="fazerLogin" placeholder="******" />
      </div>

      <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

      <button @click="fazerLogin" class="btn-login" :disabled="isLoading">
        {{ isLoading ? 'Verificando...' : 'Entrar no PDV' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-sepia);
  background-image: radial-gradient(circle at center, transparent 0%, rgba(58, 38, 24, 0.05) 100%);
}

.login-glass-box {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(107, 76, 58, 0.2);
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 350px;
  text-align: center;
  box-shadow: 0 15px 35px rgba(58, 38, 24, 0.15);
}

.login-logo {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: contain;
  margin-bottom: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  background-color: var(--bg-sepia);
  padding: 5px;
}

.login-glass-box h2 {
  color: var(--coffee-dark);
  margin-bottom: 25px;
  font-weight: 600;
  font-family: 'Playfair Display', serif;
}

.form-group {
  text-align: left;
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: 600;
  color: var(--coffee-medium);
  margin-bottom: 5px;
  font-size: 0.9em;
}
.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--coffee-light);
  border-radius: 8px;
  box-sizing: border-box;
  font-family: 'Poppins', sans-serif;
  font-size: 1em;
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  transition: border-color 0.3s;
}
.form-group input:focus {
  border-color: var(--accent);
}

.error-msg {
  color: #d32f2f;
  font-weight: bold;
  font-size: 0.9em;
  margin-bottom: 15px;
  background: #ffebee;
  padding: 10px;
  border-radius: 8px;
}

.btn-login {
  background-color: var(--accent);
  color: white;
  border: none;
  padding: 15px;
  width: 100%;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1.1em;
  transition: all 0.3s;
  margin-top: 10px;
}
.btn-login:hover:not(:disabled) {
  background-color: var(--coffee-dark);
  transform: translateY(-2px);
}
.btn-login:disabled {
  background-color: var(--coffee-light);
  cursor: not-allowed;
}
</style>
