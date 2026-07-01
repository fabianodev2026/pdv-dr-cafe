import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ProductManager.css'

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string
  image_url?: string
  barcode?: string
  category?: ProductCategory
  stock_quantity?: number
  low_stock_threshold?: number
}

type ProductCategory = 'comida' | 'bebida' | 'fitness' | 'presente'

interface NewProduct {
  name: string
  price: string
  description: string
  image_url: string
  barcode: string
  category: ProductCategory
  stock_quantity: string
  low_stock_threshold: string
}

const categoryLabels: Record<ProductCategory, string> = {
  comida: 'Produtos do cafe',
  bebida: 'Bebidas',
  fitness: 'Comida fitness',
  presente: 'Presentes e lembrancinhas',
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '',
    price: '',
    description: '',
    image_url: '',
    barcode: '',
    category: 'comida',
    stock_quantity: '0',
    low_stock_threshold: '0',
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

    if (newProduct.name.length > 60) {
      alert('O nome deve ter no máximo 60 caracteres.')
      return
    }

    if (newProduct.description.length > 80) {
      alert('A descrição deve ter no máximo 80 caracteres.')
      return
    }

    const barcode = newProduct.barcode.replace(/\D/g, '')
    if (barcode && (barcode.length < 6 || barcode.length > 20)) {
      alert('O codigo de barras deve ter entre 6 e 20 numeros.')
      return
    }

    const stockQuantity = Math.max(
      0,
      Number.parseInt(newProduct.stock_quantity || '0', 10) || 0,
    )
    const lowStockThreshold = Math.max(
      0,
      Number.parseInt(newProduct.low_stock_threshold || '0', 10) || 0,
    )

    try {
      const productData = {
        name: newProduct.name,
        unit_price: parseFloat(newProduct.price),
        description: newProduct.description,
        image_url: newProduct.image_url,
        barcode: barcode || null,
        category: newProduct.category,
        stock_quantity: stockQuantity,
        low_stock_threshold: lowStockThreshold,
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
      barcode: product.barcode || '',
      category: product.category || 'comida',
      stock_quantity: String(product.stock_quantity ?? 0),
      low_stock_threshold: String(product.low_stock_threshold ?? 0),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setNewProduct({
      name: '',
      price: '',
      description: '',
      image_url: '',
      barcode: '',
      category: 'comida',
      stock_quantity: '0',
      low_stock_threshold: '0',
    })
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

  const lowStockProducts = products.filter((product) => {
    const threshold = Number(product.low_stock_threshold || 0)
    return threshold > 0 && Number(product.stock_quantity || 0) <= threshold
  })
  const filteredProducts = products.filter((product) => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return true

    return [
      product.name,
      product.description || '',
      product.barcode || '',
      product.category || '',
      categoryLabels[product.category || 'comida'],
    ]
      .join(' ')
      .toLowerCase()
      .includes(search)
  })

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
              maxLength={60}
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
            <label>Categoria</label>
            <select
              value={newProduct.category}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  category: e.target.value as ProductCategory,
                })
              }
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Codigo de barras</label>
            <input
              type="text"
              value={newProduct.barcode}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  barcode: e.target.value.replace(/\D/g, ''),
                })
              }
              placeholder="Escaneie ou digite"
              inputMode="numeric"
              maxLength={20}
            />
          </div>
          <div className="form-group stock-field">
            <label>Estoque atual</label>
            <input
              type="number"
              min="0"
              step="1"
              value={newProduct.stock_quantity}
              onChange={(e) =>
                setNewProduct({ ...newProduct, stock_quantity: e.target.value })
              }
              placeholder="Ex: 30"
            />
          </div>
          <div className="form-group stock-field">
            <label>Avisar estoque baixo em</label>
            <input
              type="number"
              min="0"
              step="1"
              value={newProduct.low_stock_threshold}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  low_stock_threshold: e.target.value,
                })
              }
              placeholder="Ex: 5"
            />
          </div>
          <div className="form-group full-width">
            <label>Descrição do produto ({newProduct.description.length}/80)</label>
            <textarea
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct({ ...newProduct, description: e.target.value })
              }
              placeholder="Descreva o produto..."
              rows={3}
              maxLength={80}
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
        <div className="products-section-heading">
          <div>
            <h2>Produtos Cadastrados</h2>
            <p>Controle estoque atual e limite de aviso baixo.</p>
          </div>
          {lowStockProducts.length > 0 && (
            <strong className="stock-alert-count">
              {lowStockProducts.length} em estoque baixo
            </strong>
          )}
        </div>
        {lowStockProducts.length > 0 && (
          <div className="stock-warning-panel">
            <strong>Estoque baixo</strong>
            <span>{lowStockProducts.map((product) => product.name).join(', ')}</span>
          </div>
        )}
        <div className="products-search">
          <label>
            Pesquisar produtos cadastrados
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar por nome, categoria, descricao ou codigo"
            />
          </label>
          <strong>
            {filteredProducts.length} de {products.length} produto(s)
          </strong>
        </div>
        {products.length === 0 ? (
          <p className="no-products">Nenhum produto cadastrado ainda.</p>
        ) : filteredProducts.length === 0 ? (
          <p className="no-products">Nenhum produto encontrado para esta pesquisa.</p>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`product-card ${
                  Number(product.low_stock_threshold || 0) > 0 &&
                  Number(product.stock_quantity || 0) <=
                    Number(product.low_stock_threshold || 0)
                    ? 'low-stock'
                    : ''
                }`}
              >
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
                  <span className="category-pill">
                    {categoryLabels[product.category || 'comida']}
                  </span>
                  {product.barcode && (
                    <span className="barcode-pill">
                      Cod. barras: {product.barcode}
                    </span>
                  )}
                  <div className="stock-line">
                    <span>Estoque: {Number(product.stock_quantity || 0)}</span>
                    <span>Aviso: {Number(product.low_stock_threshold || 0)}</span>
                  </div>
                  {Number(product.low_stock_threshold || 0) > 0 &&
                    Number(product.stock_quantity || 0) <=
                      Number(product.low_stock_threshold || 0) && (
                      <strong className="low-stock-badge">Estoque baixo</strong>
                    )}
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
