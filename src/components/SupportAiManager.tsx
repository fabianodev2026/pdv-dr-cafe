import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  type AiSupportDraft,
  createAiSupportDraft,
  getFiscalRetentionDays,
  readFiscalQueue,
  removeFiscalPayload,
} from '../lib/fiscalService'
import {
  isFiscalBackendConfigured,
  submitFiscalToBackend,
} from '../lib/fiscalBackend'
import { logAppError, logAppEvent, readAppLogs } from '../lib/appLogger'
import {
  getOfflineRetentionDays,
  readOfflineSales,
  syncOfflineRecords as syncQueuedOfflineRecords,
} from '../lib/offlineQueue'
import './SupportAiManager.css'

const SUPPORT_QUEUE_KEY = 'dr-cafe-ai-support-queue'

function readSupportQueue(): AiSupportDraft[] {
  try {
    const raw = localStorage.getItem(SUPPORT_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function SupportAiManager() {
  const [supportQueue, setSupportQueue] = useState<AiSupportDraft[]>(() => readSupportQueue())
  const [logs, setLogs] = useState(() => readAppLogs())
  const [fiscalQueue, setFiscalQueue] = useState(() => readFiscalQueue())
  const [offlineSales, setOfflineSales] = useState(() => readOfflineSales())
  const [syncMessage, setSyncMessage] = useState('')

  const offlineByType = useMemo(
    () =>
      offlineSales.reduce(
        (summary, sale) => ({
          ...summary,
          [sale.targetTable]: (summary[sale.targetTable] ?? 0) + 1,
        }),
        { sales: 0, pending_payments: 0 },
      ),
    [offlineSales],
  )

  const refreshQueues = () => {
    setLogs(readAppLogs())
    setFiscalQueue(readFiscalQueue())
    setOfflineSales(readOfflineSales())
  }

  const createDraft = () => {
    const draft = createAiSupportDraft(logs)
    const nextQueue = [draft, ...supportQueue]
    localStorage.setItem(SUPPORT_QUEUE_KEY, JSON.stringify(nextQueue))
    setSupportQueue(nextQueue)
  }

  const syncOfflineRecords = async () => {
    setSyncMessage('Sincronizando vendas e pendencias offline...')

    const result = await syncQueuedOfflineRecords(async (sale) => {
      const { error } = await supabase.from(sale.targetTable).insert([sale.payload])
      return { error }
    })

    result.errors.forEach((entry) => {
      logAppError({
        source: 'SupportAiManager',
        action: 'syncOfflineRecords',
        error: entry.error,
        details: { offlineId: entry.id, targetTable: entry.targetTable },
      })
    })

    refreshQueues()
    setSyncMessage(
      `Offline: ${result.synced} sincronizado(s), ${result.failed} com erro, ${result.remaining} restante(s).`,
    )
  }

  const syncFiscalRequests = async () => {
    setSyncMessage(
      isFiscalBackendConfigured()
        ? 'Enviando fila fiscal para backend fiscal...'
        : 'Backend fiscal nao configurado. Enviando fila para fiscal_requests...',
    )
    let synced = 0
    let failed = 0

    for (const request of fiscalQueue) {
      try {
        if (isFiscalBackendConfigured()) {
          await submitFiscalToBackend(request)
        } else {
          const { error } = await supabase.from('fiscal_requests').insert([
            {
              sale_id: request.saleId,
              customer_cpf: request.customerCpf ?? null,
              total_amount: request.totalAmount,
              payment_method: request.paymentMethod,
              items: request.items,
              status: request.status,
            },
          ])

          if (error) throw error
        }

        synced += 1
        removeFiscalPayload(request.saleId)
      } catch (error) {
        failed += 1
        logAppError({
          source: 'SupportAiManager',
          action: 'syncFiscalRequests',
          error,
          details: { saleId: request.saleId },
        })
      }
    }

    refreshQueues()
    setSyncMessage(`Fiscal: ${synced} enviado(s), ${failed} com erro.`)
  }

  const registerSupportReview = async () => {
    const draft = createAiSupportDraft(logs)
    const { error } = await supabase.from('support_ai_reviews').insert([
      {
        title: draft.title,
        status: draft.status,
        summary: draft.summary,
        logs: draft.logs,
      },
    ])

    if (error) {
      logAppError({
        source: 'SupportAiManager',
        action: 'registerSupportReview',
        error,
      })
      createDraft()
      setSyncMessage('Supabase indisponivel. Analise ficou salva localmente.')
      return
    }

    logAppEvent({
      level: 'info',
      source: 'SupportAiManager',
      action: 'registerSupportReview',
      message: 'Analise de suporte registrada no Supabase.',
    })
    setSyncMessage('Analise registrada em support_ai_reviews.')
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
          <small>
            vendas {offlineByType.sales} / pendencias {offlineByType.pending_payments}
          </small>
        </article>
        <article>
          <span>Fila fiscal</span>
          <strong>{fiscalQueue.length}</strong>
        </article>
      </section>

      <section className="support-ai-retention">
        <p>
          Retencao local: offline ate {getOfflineRetentionDays()} dias; fiscal ate{' '}
          {getFiscalRetentionDays()} dias. Depois da sincronizacao, os dados locais
          sincronizados sao apagados deste navegador.
        </p>
      </section>

      {syncMessage && <div className="support-ai-message">{syncMessage}</div>}

      <div className="support-ai-actions">
        <button className="support-ai-primary" onClick={registerSupportReview}>
          Registrar analise no suporte
        </button>
        <button onClick={syncOfflineRecords} disabled={offlineSales.length === 0}>
          Sincronizar offline
        </button>
        <button onClick={syncFiscalRequests} disabled={fiscalQueue.length === 0}>
          Enviar fila fiscal
        </button>
        <button onClick={refreshQueues}>Atualizar filas</button>
      </div>

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
