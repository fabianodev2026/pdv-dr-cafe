import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './DailyLunchManager.css'

interface DailyLunch {
  id: number
  serving_date: string
  dish_name: string
  description?: string
  price: number
  image_url?: string
  active: boolean
}

const today = new Date().toISOString().slice(0, 10)

export default function DailyLunchManager() {
  const [lunches, setLunches] = useState<DailyLunch[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    serving_date: today,
    dish_name: '',
    description: '',
    price: '',
    image_url: '',
    active: true,
  })

  const fetchLunches = async () => {
    const { data, error } = await supabase
      .from('daily_lunches')
      .select('*')
      .order('serving_date', { ascending: false })

    if (error) {
      setMessage('Execute o SQL do app para criar a tabela daily_lunches.')
      return
    }

    setMessage('')
    setLunches(data ?? [])
  }

  useEffect(() => {
    fetchLunches()
  }, [])

  const saveLunch = async () => {
    if (!form.dish_name.trim() || !form.price) {
      setMessage('Preencha prato do dia e preco.')
      return
    }

    const lunchData = {
      serving_date: form.serving_date,
      dish_name: form.dish_name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      image_url: form.image_url.trim(),
      active: form.active,
    }

    const { error } = await supabase
      .from('daily_lunches')
      .upsert([lunchData], { onConflict: 'serving_date' })

    if (error) {
      setMessage(`Erro ao salvar almoco: ${error.message}`)
      return
    }

    setForm({
      serving_date: today,
      dish_name: '',
      description: '',
      price: '',
      image_url: '',
      active: true,
    })
    setMessage('Almoco do dia salvo.')
    fetchLunches()
  }

  const editLunch = (lunch: DailyLunch) => {
    setForm({
      serving_date: lunch.serving_date,
      dish_name: lunch.dish_name,
      description: lunch.description || '',
      price: String(lunch.price),
      image_url: lunch.image_url || '',
      active: lunch.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleLunch = async (lunch: DailyLunch) => {
    const { error } = await supabase
      .from('daily_lunches')
      .update({ active: !lunch.active })
      .eq('id', lunch.id)

    if (error) {
      setMessage(`Erro ao atualizar almoco: ${error.message}`)
      return
    }

    fetchLunches()
  }

  return (
    <div className="daily-lunch-manager">
      <header className="daily-lunch-heading">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <h1>Almoco do dia</h1>
          <p>Edite o prato servido hoje no app e no sistema.</p>
        </div>
      </header>

      {message && <div className="daily-lunch-alert">{message}</div>}

      <section className="daily-lunch-form">
        <label>
          Data
          <input
            type="date"
            value={form.serving_date}
            onChange={(e) => setForm({ ...form, serving_date: e.target.value })}
          />
        </label>
        <label>
          Prato do dia ({form.dish_name.length}/30)
          <input
            value={form.dish_name}
            maxLength={30}
            onChange={(e) => setForm({ ...form, dish_name: e.target.value })}
            placeholder="Ex: Frango grelhado"
          />
        </label>
        <label>
          Preco
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Ex: 24.90"
          />
        </label>
        <label>
          Imagem
          <input
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="daily-lunch-form__full">
          Descricao
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Complementos do prato"
            rows={3}
          />
        </label>
        <label className="daily-lunch-check">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Mostrar no app
        </label>
        <button onClick={saveLunch}>Salvar almoco</button>
      </section>

      <section className="daily-lunch-list">
        {lunches.map((lunch) => (
          <article key={lunch.id} className="daily-lunch-card">
            {lunch.image_url && <img src={lunch.image_url} alt={lunch.dish_name} />}
            <div>
              <strong>{lunch.dish_name}</strong>
              <span>{new Date(lunch.serving_date).toLocaleDateString('pt-BR')}</span>
              <p>R$ {Number(lunch.price).toFixed(2)}</p>
              {lunch.description && <small>{lunch.description}</small>}
            </div>
            <div className="daily-lunch-actions">
              <button onClick={() => editLunch(lunch)}>Editar</button>
              <button onClick={() => toggleLunch(lunch)}>
                {lunch.active ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
