import { useEffect, useMemo, useState } from 'react'
import './QrCodePrintManager.css'

type QrTargetType = 'table' | 'room'

interface QrTarget {
  id: string
  type: QrTargetType
  number: number
  label: string
  url: string
}

interface QrCodeItem extends QrTarget {
  dataUrl: string
}

const tableNumbers = Array.from({ length: 6 }, (_, index) => index + 1)
const roomNumbers = [
  ...Array.from({ length: 7 }, (_, index) => 101 + index),
  ...Array.from({ length: 11 }, (_, index) => 201 + index),
  ...Array.from({ length: 15 }, (_, index) => 301 + index),
]
const PUBLIC_MENU_URL =
  import.meta.env.VITE_PUBLIC_MENU_URL || 'https://pdv-dr-cafe.vercel.app'

const getBaseUrl = () => {
  if (typeof window === 'undefined') return ''
  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  return isLocalPreview ? PUBLIC_MENU_URL : window.location.origin
}

export default function QrCodePrintManager() {
  const [baseUrl, setBaseUrl] = useState(getBaseUrl)
  const [filter, setFilter] = useState<'todos' | QrTargetType>('todos')
  const [codes, setCodes] = useState<QrCodeItem[]>([])

  const targets = useMemo<QrTarget[]>(() => {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
    const tables = tableNumbers.map((number) => ({
      id: `table-${number}`,
      type: 'table' as const,
      number,
      label: `Mesa ${number}`,
      url: `${normalizedBaseUrl}/cardapio?table=${number}`,
    }))
    const rooms = roomNumbers.map((number) => ({
      id: `room-${number}`,
      type: 'room' as const,
      number,
      label: `Quarto ${number}`,
      url: `${normalizedBaseUrl}/cardapio?room=${number}`,
    }))

    return [...tables, ...rooms]
  }, [baseUrl])

  const visibleCodes = useMemo(
    () => codes.filter((code) => filter === 'todos' || code.type === filter),
    [codes, filter],
  )

  useEffect(() => {
    let active = true

    async function generateCodes() {
      const QRCode = await import('qrcode')
      const nextCodes = await Promise.all(
        targets.map(async (target) => ({
          ...target,
          dataUrl: await QRCode.toDataURL(target.url, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 220,
            color: {
              dark: '#2b160d',
              light: '#fffaf5',
            },
          }),
        })),
      )

      if (active) setCodes(nextCodes)
    }

    generateCodes()

    return () => {
      active = false
    }
  }, [targets])

  const printQrCodes = () => {
    document.body.classList.add('printing-qr')
    const clearPrintMode = () => {
      document.body.classList.remove('printing-qr')
      window.removeEventListener('afterprint', clearPrintMode)
    }

    window.addEventListener('afterprint', clearPrintMode)
    window.print()
    window.setTimeout(clearPrintMode, 1000)
  }

  return (
    <section className="qr-manager">
      <div className="qr-manager__toolbar no-print">
        <div>
          <h2>QR Code do cardapio</h2>
          <p>Imprima os codigos das mesas e quartos para abrir o cardapio Dr. Cafe.</p>
        </div>
        <button onClick={printQrCodes}>Imprimir QR Codes</button>
      </div>

      <div className="qr-manager__controls no-print">
        <label>
          Link publico do cardapio
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://pdv-dr-cafe.vercel.app"
          />
          <small>
            Para celular funcionar, use o link da Vercel ou um dominio publico.
          </small>
        </label>
        <label>
          Mostrar
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="todos">Mesas e quartos</option>
            <option value="table">Somente mesas</option>
            <option value="room">Somente quartos</option>
          </select>
        </label>
      </div>

      <div className="qr-manager__print-title">
        <img src="/logo.jpeg" alt="Dr. Cafe" />
        <div>
          <strong>Dr. Cafe</strong>
          <span>Cardapio digital</span>
        </div>
      </div>

      <div className="qr-manager__grid">
        {visibleCodes.map((code) => (
          <article key={code.id} className="qr-manager__card">
            <img className="qr-manager__logo" src="/logo.jpeg" alt="" />
            <h3>{code.label}</h3>
            <img className="qr-manager__code" src={code.dataUrl} alt={`QR Code ${code.label}`} />
            <p>Aponte a camera para ver o cardapio.</p>
            <small>{code.url}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
