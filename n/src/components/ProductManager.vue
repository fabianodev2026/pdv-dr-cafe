<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const products = ref([])
const newProduct = ref({ name: '', unit_price: 0, description: '' })
const loading = ref(false)
const error = ref(null)

const fetchProducts = async () => {
  loading.value = true
  error.value = null
  try {
    const { data, fetchError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (fetchError) throw fetchError
    if (data) products.value = data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const addProduct = async () => {
  loading.value = true
  error.value = null
  try {
    const { data, addError } = await supabase
      .from('products')
      .insert([
        {
          name: newProduct.value.name,
          unit_price: parseFloat(newProduct.value.unit_price),
          description: newProduct.value.description,
        },
      ])
      .select()
    if (addError) throw addError
    if (data) products.value = [...products.value, data[0]]
    newProduct.value = { name: '', unit_price: 0, description: '' }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div class="product-manager">
    <header class="header">
      <h1 class="title">Gestão de Produtos - Dr. Café</h1>
    </header>

    <div v-if="loading" class="status loading">Carregando...</div>
    <div v-if="error" class="status error">
      Erro de conexão com o banco de dados. Verifique suas chaves no .env
    </div>

    <section class="add-product-form">
      <h2>Novo Produto</h2>
      <div class="form-group">
        <label for="product-name">Nome do Produto</label>
        <input
          type="text"
          id="product-name"
          v-model="newProduct.name"
          placeholder="Ex: Café Expresso"
          required
        />
      </div>
      <div class="form-group">
        <label for="product-price">Preço Unitário (R$)</label>
        <input
          type="number"
          id="product-price"
          v-model="newProduct.unit_price"
          placeholder="Ex: 5.50"
          step="0.01"
          required
        />
      </div>
      <div class="form-group">
        <label for="product-desc">Descrição</label>
        <textarea
          id="product-desc"
          v-model="newProduct.description"
          placeholder="Ex: Café em grãos moído na hora."
          rows="3"
        ></textarea>
      </div>
      <button @click="addProduct" :disabled="loading" class="btn-primary">Adicionar Produto</button>
    </section>

    <section class="product-list">
      <h2>Lista de Produtos</h2>
      <div v-if="products.length === 0" class="no-products">Nenhum produto cadastrado.</div>
      <div v-else class="products-grid">
        <div v-for="product in products" :key="product.id" class="product-card">
          <div class="product-info">
            <h3 class="product-name">{{ product.name }}</h3>
            <p class="product-price">R$ {{ product.unit_price.toFixed(2) }}</p>
            <p class="product-description">{{ product.description }}</p>
          </div>
          <div class="product-photo-placeholder">Sem Foto</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.product-manager {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
  text-align: center;
}

.status {
  text-align: center;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
}

.loading {
  background-color: #f1f8e9;
  color: #558b2f;
}
.error {
  background-color: #ffebee;
  color: #c62828;
}

.add-product-form,
.product-list {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}

.add-product-form h2,
.product-list h2 {
  font-weight: 400;
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  margin-bottom: 20px;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d7ccc8;
  border-radius: 4px;
  box-sizing: border-box;
  color: #3e2723;
}

.btn-primary {
  background-color: #5d4037;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s ease;
}
.btn-primary:hover {
  background-color: #3e2723;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-products {
  text-align: center;
  font-style: italic;
  color: #795548;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.product-card {
  border: 1px solid #d7ccc8;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.product-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.1);
}

.product-info {
  padding: 15px;
  flex-grow: 1;
}
.product-name {
  font-size: 1.3em;
  margin-top: 0;
  margin-bottom: 5px;
  font-weight: 400;
}
.product-price {
  font-size: 1.1em;
  font-weight: bold;
  color: #5d4037;
  margin-bottom: 10px;
}
.product-description {
  font-size: 0.9em;
  color: #795548;
}
.product-photo-placeholder {
  background-color: #d7ccc8;
  color: #5d4037;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1em;
  font-weight: bold;
}
</style>
