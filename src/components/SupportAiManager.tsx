import { useMemo, useState } from 'react'
import { createAiSupportDraft, readFiscalQueue } from '../lib/fiscalService'
import { readAppLogs } from '../lib/appLogger'
import { readOfflineSales } from '../lib/offlineQueue'
import './SupportAiManager.css'

const SUPPORT_QUEUE_KEY = 'dr-cafe-ai-support-queue'

function readSupportQueue() {
  try {
    const raw = localStorage.getItem(SUPPORT_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function SupportAiManager() {
  const [supportQueue, setSupportQueue] = useState<any[]>(() => readSupportQueue())
  const logs = useMemo(() => readAppLogs(), [])
  const fiscalQueue = useMemo(() => readFiscalQueue(), [])
  const offlineSales = useMemo(() => readOfflineSales(), [])

  const createDraft = () => {
    const draft = createAiSupportDraft(logs)
    const nextQueue = [draft, ...supportQueue]
    localStorage.setItem(SUPPORT_QUEUE_KEY, JSON.stringify(nextQueue))
    setSupportQueue(nextQueue)
  }

  return (
    <div className="support-ai-page">
      <header>
        <span>Suporte tecnico</span>
        <h1>Ajuda com IA</h1>
        <p>Fila de analise para erros, vendas offline e pendencias fiscais.</p>
      </header>

      <section className="support-ai-summary">
        <article>
          <span>Logs</span>
          <strong>{logs.length}</strong>
        </article>
        <article>
          <span>Vendas offline</span>
          <strong>{offlineSales.length}</strong>
        </article>
        <article>
          <span>Fila fiscal</span>
          <strong>{fiscalQueue.length}</strong>
        </article>
      </section>

      <button className="support-ai-primary" onClick={createDraft}>
        Gerar analise para suporte
      </button>

      <section className="support-ai-list">
        {supportQueue.length === 0 ? (
          <p>Nenhuma analise criada ainda.</p>
        ) : (
          supportQueue.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
              <p>{item.summary}</p>
              <pre>{JSON.stringify(item.logs, null, 2)}</pre>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
