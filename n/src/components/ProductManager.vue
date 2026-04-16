<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase' // Conexão com o banco

const products = ref([])

// Variável que guarda os dados do formulário
const newProduct = ref({ name: '', price: '', description: '' })

// MÁGICA NOVA: Essa variável descobre se estamos CRIANDO ou EDITANDO um produto
const editingId = ref(null)

// 1. Busca os produtos na nuvem
const fetchProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) throw error
    if (data) products.value = data
  } catch (err) {
    console.error('Erro ao buscar produtos:', err.message)
  }
}

// 2. Salva (ou Atualiza) o produto
const saveProduct = async () => {
  if (!newProduct.value.name || !newProduct.value.price) {
    alert('Preencha o nome e o preço!')
    return
  }

  try {
    if (editingId.value) {
      // MODO EDIÇÃO: Atualiza o produto existente
      const { error } = await supabase
        .from('products')
        .update({
          name: newProduct.value.name,
          unit_price: parseFloat(newProduct.value.price),
          description: newProduct.value.description,
        })
        .eq('id', editingId.value) // Atualiza APENAS o produto com este ID

      if (error) throw error
      alert('Produto atualizado com sucesso!')
    } else {
      // MODO CRIAÇÃO: Insere um produto novo
      const { error } = await supabase.from('products').insert([
        {
          name: newProduct.value.name,
          unit_price: parseFloat(newProduct.value.price),
          description: newProduct.value.description,
        },
      ])

      if (error) throw error
    }

    // Limpa o formulário e busca a lista atualizada
    cancelEdit()
    fetchProducts()
  } catch (err) {
    console.error('Erro ao salvar produto:', err.message)
  }
}

// 3. Prepara o formulário para edição (Botão de Lápis)
const editProduct = (product) => {
  editingId.value = product.id
  newProduct.value = {
    name: product.name,
    price: product.unit_price,
    description: product.description || '',
  }
  // Rola a tela para o topo suavemente para a pessoa ver o formulário
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 4. Cancela a edição e limpa o formulário
const cancelEdit = () => {
  editingId.value = null
  newProduct.value = { name: '', price: '', description: '' }
}

// 5. Apaga o produto do banco (Botão de Lixeira)
const deleteProduct = async (id, name) => {
  // Pede uma confirmação antes de apagar para evitar acidentes
  const confirmDelete = confirm(`Tem certeza que deseja apagar o produto "${name}"?`)
  if (!confirmDelete) return

  try {
    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) throw error
    fetchProducts() // Atualiza a lista na tela
  } catch (err) {
    console.error('Erro ao apagar produto:', err.message)
    alert('Erro ao apagar. Pode ser que esse produto já esteja em uma comanda!')
  }
}

// Quando a tela carregar, busca os produtos
onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div class="product-manager">
    <header class="header">
      <h1 class="title">Gestão de Produtos</h1>
    </header>

    <section class="form-section">
      <h2 class="section-title">
        {{ editingId ? '✏️ Editando Produto' : '➕ Adicionar Novo Produto' }}
      </h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Nome do Produto</label>
          <input type="text" v-model="newProduct.name" placeholder="Ex: Café Expresso" />
        </div>
        <div class="form-group">
          <label>Preço (R$)</label>
          <input type="number" step="0.01" v-model="newProduct.price" placeholder="Ex: 5.50" />
        </div>
        <div class="form-group full-width">
          <label>Descrição Opcional</label>
          <input
            type="text"
            v-model="newProduct.description"
            placeholder="Ex: 50ml de café arábica"
          />
        </div>
      </div>

      <div class="form-actions">
        <button v-if="editingId" @click="cancelEdit" class="btn-cancel">Cancelar</button>
        <button @click="saveProduct" class="btn-submit">
          {{ editingId ? 'Salvar Alterações' : 'Adicionar Produto' }}
        </button>
      </div>
    </section>

    <section class="list-section">
      <h2 class="section-title">📦 Produtos Cadastrados</h2>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Preço Unitário</th>
              <th class="actions-column">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <td class="product-name">{{ product.name }}</td>
              <td class="product-desc">{{ product.description || '-' }}</td>
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
            <tr v-if="products.length === 0">
              <td colspan="4" class="empty-state">Nenhum produto cadastrado ainda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.product-manager {
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
  margin: 0;
}

.section-title {
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  padding-bottom: 10px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 400;
}
.form-section,
.list-section {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}

/* Formulário */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.full-width {
  grid-column: 1 / -1;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: #4e342e;
}
.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d7ccc8;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1em;
  transition: border-color 0.2s;
}
.form-group input:focus {
  border-color: #5d4037;
  outline: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}
.btn-submit {
  background-color: #5d4037;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}
.btn-submit:hover {
  background-color: #3e2723;
}
.btn-cancel {
  background-color: #f5f5f5;
  color: #5d4037;
  border: 1px solid #d7ccc8;
  padding: 12px 25px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}
.btn-cancel:hover {
  background-color: #e0e0e0;
}

/* Tabela */
.table-container {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th,
.data-table td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid #d7ccc8;
}
.data-table th {
  background-color: #f5f5f5;
  color: #5d4037;
  font-weight: bold;
}
.product-name {
  font-weight: bold;
  color: #3e2723;
}
.product-desc {
  color: #795548;
  font-size: 0.9em;
}
.product-price {
  font-weight: bold;
  color: #2e7d32;
}

/* Botões de Ação na Tabela */
.actions-column {
  text-align: right;
  white-space: nowrap;
}
.btn-icon {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: 5px;
  margin-left: 10px;
  transition: transform 0.2s;
  border-radius: 4px;
}
.btn-icon:hover {
  transform: scale(1.2);
}
.btn-icon.edit:hover {
  background-color: #e3f2fd;
}
.btn-icon.delete:hover {
  background-color: #ffebee;
}

.empty-state {
  text-align: center;
  color: #795548;
  font-style: italic;
  padding: 30px;
}
</style>
