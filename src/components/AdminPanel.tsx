import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminPanel() {
  const [produtos, setProdutos] = useState<any[]>([])
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    fetchProdutos()
  }, [])

  async function fetchProdutos() {
    const { data } = await supabase.from('produtos').select('*').order('nome')
    if (data) setProdutos(data)
  }

  const handleUpdate = async (id: number, campo: string, valor: any) => {
    if (campo === 'nome' && String(valor).length > 25) {
      setMensagem('⚠️ Erro: Nome muito longo (máx 25).')
      return
    }
    const { error } = await supabase
      .from('produtos')
      .update({ [campo]: valor })
      .eq('id', id)
    if (!error) {
      setMensagem(`✅ Sincronizado [2026-04-28]`)
      setTimeout(() => setMensagem(''), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4 font-sans">
      <h1 className="text-xl font-bold text-amber-500 mb-4 text-center">Dr. Café - Admin React</h1>
      {mensagem && (
        <div className="bg-zinc-800 border-l-4 border-amber-500 p-2 mb-4 text-sm">{mensagem}</div>
      )}
      <div className="grid gap-3">
        {produtos.map((p) => (
          <div key={p.id} className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
            <input
              className="bg-zinc-900 border border-zinc-600 w-full p-2 rounded mb-2 outline-none focus:border-amber-500"
              defaultValue={p.nome}
              maxLength={25}
              onBlur={(e) => handleUpdate(p.id, 'nome', e.target.value)}
            />
            <div className="flex gap-2">
              <input
                type="number"
                className="bg-zinc-900 p-2 rounded w-full"
                defaultValue={p.preco}
                onBlur={(e) => handleUpdate(p.id, 'preco', parseFloat(e.target.value))}
              />
              <input
                type="number"
                className="bg-zinc-900 p-2 rounded w-full"
                defaultValue={p.quantidade}
                onBlur={(e) => handleUpdate(p.id, 'quantidade', parseInt(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
