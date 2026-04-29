import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './CustomerMenu.css'

interface Product {
  id: number
  name: string
  unit_price: number
  description?: string | null
  image_url?: string | null
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function CustomerMenu() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const roomLabel = useMemo(() => {
    const room = searchParams.get('room')?.trim()
    const roomNumber = Number(room)

    if (!room || !Number.isInteger(roomNumber) || roomNumber < 101 || roomNumber > 315) {
      return 'Quarto nao informado'
    }

    return `Quarto ${roomNumber}`
  }, [searchParams])

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, description, image_url')
        .order('name')

      if (error) {
        setErrorMessage('Nao foi possivel carregar o cardapio.')
        setIsLoading(false)
        return
      }

      setProducts(data ?? [])
      setIsLoading(false)
    }

    fetchProducts()
  }, [])

  return (
    <main className="customer-menu">
      <header className="customer-menu__header">
        <div>
          <p className="customer-menu__eyebrow">Dr. Cafe</p>
          <h1>Cardapio</h1>
        </div>
        <span className="customer-menu__room">{roomLabel}</span>
      </header>

      {isLoading && <p className="customer-menu__state">Carregando cardapio...</p>}

      {errorMessage && <p className="customer-menu__state customer-menu__state--error">{errorMessage}</p>}

      {!isLoading && !errorMessage && products.length === 0 && (
        <p className="customer-menu__state">Nenhum produto disponivel no momento.</p>
      )}

      <section className="customer-menu__grid" aria-label="Produtos">
        {products.map((product) => (
          <article className="customer-menu__item" key={product.id}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} />
            ) : (
              <div className="customer-menu__image-fallback" aria-hidden="true">
                Dr.
              </div>
            )}
            <div className="customer-menu__info">
              <div className="customer-menu__line">
                <h2>{product.name.slice(0, 25)}</h2>
                <strong>{currencyFormatter.format(product.unit_price)}</strong>
              </div>
              {product.description && <p>{product.description}</p>}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
