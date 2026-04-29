import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ProductManager.css'

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string
  image_url?: string
}

interface NewProduct {
  name: string
  price: string
  description: string
  image_url: string
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '',
    price: '',
    description: '',
    image_url: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
      if (error) throw error
      if (data) setProducts(data)
    } catch (err) {
      console.error('Erro ao buscar produtos:', (err as Error).message)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const saveProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      alert('Preencha o nome e o preço!')
      return
    }

    if (newProduct.description.length > 25) {
      alert('A descrição deve ter no máximo 25 caracteres.')
      return
    }

    try {
      const productData = {
        name: newProduct.name,
        unit_price: parseFloat(newProduct.price),
        description: newProduct.description,
        image_url: newProduct.image_url,
      }

      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId)
        if (error) throw error
        alert('Produto atualizado!')
      } else {
        const { error } = await supabase.from('products').insert([productData])
        if (error) throw error
        alert('Produto adicionado!')
      }

      cancelEdit()
      fetchProducts()
    } catch (err) {
      alert('Erro ao salvar produto: ' + (err as Error).message)
    }
  }

  const editProduct = (product: Product) => {
    setEditingId(product.id)
    setNewProduct({
      name: product.name,
      price: product.unit_price.toString(),
      description: product.description || '',
      image_url: product.image_url || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setNewProduct({ name: '', price: '', description: '', image_url: '' })
  }

  const deleteProduct = async (id: number, name: string) => {
    if (!confirm(`Apagar o produto "${name}"?`)) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== id),
      )
      fetchProducts()
    } catch (err) {
      alert('Erro ao apagar produto: ' + (err as Error).message)
    }
  }

  return (
    <div className="product-manager">
      <header className="product-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Produtos</h1>
          <p>Cadastre itens do cardapio com descricao curta para venda rapida.</p>
        </div>
      </header>

      <section className="form-section glass-panel">
        <h2 className="section-title">
          {editingId ? '✏️ Editando Produto' : '➕ Adicionar Novo Produto'}
        </h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Nome do Produto</label>
            <input
              type="text"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, name: e.target.value })
              }
              placeholder="Ex: Capuccino"
              maxLength={25}
            />
          </div>
          <div className="form-group">
            <label>Preço (R$)</label>
            <input
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) =>
                setNewProduct({ ...newProduct, price: e.target.value })
              }
              placeholder="Ex: 12.50"
            />
          </div>
          <div className="form-group">
            <label>Link da Foto (URL da Imagem)</label>
            <input
              type="text"
              value={newProduct.image_url}
              onChange={(e) =>
                setNewProduct({ ...newProduct, image_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>
          <div className="form-group full-width">
            <label>Descrição do produto ({newProduct.description.length}/25)</label>
            <textarea
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct({ ...newProduct, description: e.target.value })
              }
              placeholder="Descreva o produto..."
              rows={3}
              maxLength={25}
            />
          </div>
        </div>
        <div className="button-group">
          <button onClick={saveProduct} className="btn-primary">
            {editingId ? 'Atualizar Produto' : 'Adicionar Produto'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="btn-secondary">
              Cancelar
            </button>
          )}
        </div>
      </section>

      <section className="products-section">
        <h2>Produtos Cadastrados</h2>
        {products.length === 0 ? (
          <p className="no-products">Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                {product.image_url && (
                  <div className="product-image">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="price">R$ {product.unit_price.toFixed(2)}</p>
                  {product.description && (
                    <p className="description">{product.description}</p>
                  )}
                </div>
                <div className="product-actions">
                  <button
                    onClick={() => editProduct(product)}
                    className="btn-edit"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id, product.name)}
                    className="btn-delete"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
