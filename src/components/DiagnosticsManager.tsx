import { useMemo, useState } from 'react'
import { clearAppLogs, readAppLogs } from '../lib/appLogger'
import './DiagnosticsManager.css'

export default function DiagnosticsManager() {
  const [logs, setLogs] = useState(() => readAppLogs())
  const [copyMessage, setCopyMessage] = useState('')

  const errorCount = useMemo(
    () => logs.filter((log) => log.level === 'error').length,
    [logs],
  )

  const refresh = () => {
    setLogs(readAppLogs())
    setCopyMessage('')
  }

  const clearLogs = () => {
    clearAppLogs()
    setLogs([])
    setCopyMessage('')
  }

  const copyLogs = async () => {
    await navigator.clipboard.writeText(JSON.stringify(logs, null, 2))
    setCopyMessage('Logs copiados.')
  }

  return (
    <div className="diagnostics-page">
      <header className="diagnostics-header">
        <div>
          <span>Diagnostico</span>
          <h1>Logs do aplicativo</h1>
          <p>Ultimos registros salvos neste navegador para encontrar erros com mais rapidez.</p>
        </div>
        <div className="diagnostics-actions">
          <button onClick={refresh}>Atualizar</button>
          <button onClick={copyLogs} disabled={logs.length === 0}>
            Copiar JSON
          </button>
          <button onClick={clearLogs} disabled={logs.length === 0}>
            Limpar
          </button>
        </div>
      </header>

      <section className="diagnostics-summary">
        <article>
          <span>Total</span>
          <strong>{logs.length}</strong>
        </article>
        <article>
          <span>Erros</span>
          <strong>{errorCount}</strong>
        </article>
        <article>
          <span>Ultimo evento</span>
          <strong>
            {logs[0]
              ? new Date(logs[0].timestamp).toLocaleString('pt-BR')
              : 'Nenhum'}
          </strong>
        </article>
      </section>

      {copyMessage && <div className="diagnostics-toast">{copyMessage}</div>}

      <section className="diagnostics-list">
        {logs.length === 0 ? (
          <div className="diagnostics-empty">Nenhum log registrado ainda.</div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className={`diagnostics-card ${log.level}`}>
              <div className="diagnostics-card__top">
                <span>{log.level}</span>
                <time>{new Date(log.timestamp).toLocaleString('pt-BR')}</time>
              </div>
              <h2>{log.action}</h2>
              <p>{log.message}</p>
              <dl>
                <div>
                  <dt>Origem</dt>
                  <dd>{log.source}</dd>
                </div>
                <div>
                  <dt>URL</dt>
                  <dd>{log.url}</dd>
                </div>
              </dl>
              {log.details && (
                <pre>{JSON.stringify(log.details, null, 2)}</pre>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  )
}
