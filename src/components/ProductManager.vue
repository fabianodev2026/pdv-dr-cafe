<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const products = ref([])
// Adicionamos o campo image_url
const newProduct = ref({ name: '', price: '', description: '', image_url: '' })
const editingId = ref(null)

const fetchProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) throw error
    if (data) products.value = data
  } catch (err) {
    console.error('Erro ao buscar produtos:', err.message)
  }
}

const saveProduct = async () => {
  if (!newProduct.value.name || !newProduct.value.price) {
    alert('Preencha o nome e o preço!')
    return
  }

  try {
    const productData = {
      name: newProduct.value.name,
      unit_price: parseFloat(newProduct.value.price),
      description: newProduct.value.description,
      image_url: newProduct.value.image_url, // Salva a foto
    }

    if (editingId.value) {
      await supabase.from('products').update(productData).eq('id', editingId.value)
      alert('Produto atualizado!')
    } else {
      await supabase.from('products').insert([productData])
      alert('Produto adicionado!')
    }

    cancelEdit()
    fetchProducts()
  } catch (err) {
    alert('Erro ao salvar produto: ' + err.message)
  }
}

const editProduct = (product) => {
  editingId.value = product.id
  newProduct.value = {
    name: product.name,
    price: product.unit_price,
    description: product.description || '',
    image_url: product.image_url || '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelEdit = () => {
  editingId.value = null
  newProduct.value = { name: '', price: '', description: '', image_url: '' }
}

const deleteProduct = async (id, name) => {
  if (!confirm(`Apagar o produto "${name}"?`)) return
  try {
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  } catch (err) {
    alert('Erro ao apagar. Pode estar em uso!')
  }
}

onMounted(fetchProducts)
</script>

<template>
  <div class="product-manager">
    <header class="header">
      <h1 class="title">📦 Gestão de Produtos</h1>
    </header>

    <section class="form-section glass-panel">
      <h2 class="section-title">
        {{ editingId ? '✏️ Editando Produto' : '➕ Adicionar Novo Produto' }}
      </h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Nome do Produto</label>
          <input type="text" v-model="newProduct.name" placeholder="Ex: Capuccino" />
        </div>
        <div class="form-group">
          <label>Preço (R$)</label>
          <input type="number" step="0.01" v-model="newProduct.price" placeholder="Ex: 12.50" />
        </div>
        <div class="form-group">
          <label>Link da Foto (URL da Imagem)</label>
          <input
            type="text"
            v-model="newProduct.image_url"
            placeholder="https://site.com/foto-cafe.jpg"
          />
        </div>
        <div class="form-group">
          <label>Descrição (Opcional)</label>
          <input type="text" v-model="newProduct.description" placeholder="Ingredientes..." />
        </div>
      </div>

      <div class="form-actions">
        <button v-if="editingId" @click="cancelEdit" class="btn-cancel">Cancelar</button>
        <button @click="saveProduct" class="btn-submit">
          💾 {{ editingId ? 'Salvar' : 'Adicionar' }}
        </button>
      </div>
    </section>

    <section class="list-section glass-panel">
      <h2 class="section-title">Cardápio Atual</h2>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Produto</th>
              <th>Preço</th>
              <th class="actions-column">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <td>
                <img
                  v-if="product.image_url"
                  :src="product.image_url"
                  class="product-thumb"
                  alt="Foto"
                />
                <div v-else class="no-photo">☕</div>
              </td>
              <td class="product-name">
                {{ product.name }}<br />
                <small class="product-desc">{{ product.description }}</small>
              </td>
              <td class="product-price">R$ {{ product.unit_price.toFixed(2) }}</td>
              <td class="actions-column">
                <button @click="editProduct(product)" class="btn-icon edit" title="Editar">
                  ✏️
                </button>
                <button
                  @click="deleteProduct(product.id, product.name)"
                  class="btn-icon delete"
                  title="Excluir"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.product-manager {
  color: var(--coffee-dark);
  padding: 20px;
}
.header {
  border-bottom: 2px solid var(--accent);
  margin-bottom: 30px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  margin: 0;
}
.section-title {
  color: var(--coffee-dark);
  border-bottom: 1px dashed var(--coffee-light);
  padding-bottom: 10px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 600;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 25px;
  border: 1px solid rgba(107, 76, 58, 0.2);
  box-shadow: 0 8px 32px rgba(58, 38, 24, 0.1);
  margin-bottom: 30px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: var(--coffee-dark);
  font-size: 0.9em;
}
.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--coffee-light);
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 1em;
  background: rgba(255, 255, 255, 0.9);
  font-family: 'Poppins', sans-serif;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}
.btn-submit {
  background-color: var(--coffee-dark);
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1em;
  transition: 0.3s;
}
.btn-submit:hover {
  background-color: var(--accent);
  transform: translateY(-2px);
}
.btn-cancel {
  background-color: transparent;
  color: var(--coffee-dark);
  border: 2px solid var(--coffee-medium);
  padding: 10px 25px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
}

.table-container {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
}
.data-table th,
.data-table td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.data-table th {
  background-color: rgba(107, 76, 58, 0.1);
  color: var(--coffee-dark);
}
.product-name {
  font-weight: bold;
  font-size: 1.1em;
}
.product-desc {
  color: var(--coffee-medium);
  font-weight: normal;
}
.product-price {
  font-weight: bold;
  color: #2e7d32;
  font-size: 1.1em;
}

/* Estilo da Fotinha */
.product-thumb {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
.no-photo {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  background: var(--coffee-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
}

.actions-column {
  text-align: right;
}
.btn-icon {
  background: none;
  border: none;
  font-size: 1.3em;
  cursor: pointer;
  padding: 5px;
  margin-left: 10px;
  transition: 0.2s;
}
.btn-icon:hover {
  transform: scale(1.2);
}
</style>
