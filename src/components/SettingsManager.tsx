import { useState } from 'react'
import './SettingsManager.css'

interface PrinterSettings {
  connectionType: 'usb' | 'network' | 'bluetooth'
  ipAddress: string
  paperWidth: '80mm' | '58mm'
  autoPrint: boolean
}

interface FiscalSettings {
  cnpj: string
  stateInscription: string
  environment: 'homologacao' | 'producao'
  certificateName: string
}

export default function SettingsManager() {
  const [printer, setPrinter] = useState<PrinterSettings>({
    connectionType: 'usb',
    ipAddress: '',
    paperWidth: '80mm',
    autoPrint: true,
  })

  const [fiscal, setFiscal] = useState<FiscalSettings>({
    cnpj: '',
    stateInscription: '',
    environment: 'homologacao',
    certificateName: '',
  })

  const [showSuccessMsg, setShowSuccessMsg] = useState(false)

  const saveSettings = () => {
    console.log('Salvando Impressora:', printer)
    console.log('Salvando Fiscal:', fiscal)

    setShowSuccessMsg(true)
    setTimeout(() => {
      setShowSuccessMsg(false)
    }, 3000)
  }

  return (
    <div className="settings-manager">
      <header className="header">
        <h1 className="title">Configurações do Sistema</h1>
      </header>

      {showSuccessMsg && (
        <div className="alert success">✓ Configurações salvas com sucesso!</div>
      )}

      <div className="settings-grid">
        <section className="settings-panel">
          <h2>🖨️ Configuração de Impressora</h2>

          <div className="form-group">
            <label>Tipo de Conexão</label>
            <select
              value={printer.connectionType}
              onChange={(e) =>
                setPrinter({
                  ...printer,
                  connectionType: e.target.value as PrinterSettings['connectionType'],
                })
              }
            >
              <option value="usb">Cabo USB</option>
              <option value="network">Rede / Wi-Fi (IP)</option>
              <option value="bluetooth">Bluetooth</option>
            </select>
          </div>

          {printer.connectionType === 'network' && (
            <div className="form-group">
              <label>Endereço IP da Impressora</label>
              <input
                type="text"
                value={printer.ipAddress}
                onChange={(e) =>
                  setPrinter({ ...printer, ipAddress: e.target.value })
                }
                placeholder="Ex: 192.168.1.100"
              />
            </div>
          )}

          <div className="form-group">
            <label>Tamanho da Bobina</label>
            <select
              value={printer.paperWidth}
              onChange={(e) =>
                setPrinter({
                  ...printer,
                  paperWidth: e.target.value as PrinterSettings['paperWidth'],
                })
              }
            >
              <option value="80mm">80mm (Padrão)</option>
              <option value="58mm">58mm (Pequena)</option>
            </select>
          </div>

          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="auto-print"
              checked={printer.autoPrint}
              onChange={(e) =>
                setPrinter({ ...printer, autoPrint: e.target.checked })
              }
            />
            <label htmlFor="auto-print">
              Imprimir recibo automaticamente após fechar a comanda
            </label>
          </div>
        </section>

        <section className="settings-panel">
          <h2>🧾 Configuração Fiscal (NFC-e)</h2>

          <div className="form-group">
            <label>Ambiente da Sefaz</label>
            <select
              value={fiscal.environment}
              onChange={(e) =>
                setFiscal({
                  ...fiscal,
                  environment: e.target.value as FiscalSettings['environment'],
                })
              }
            >
              <option value="homologacao">Homologação (Ambiente de Testes)</option>
              <option value="producao">Produção (Valendo de verdade)</option>
            </select>
          </div>

          <div className="form-group">
            <label>CNPJ da Empresa</label>
            <input
              type="text"
              value={fiscal.cnpj}
              onChange={(e) =>
                setFiscal({ ...fiscal, cnpj: e.target.value })
              }
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="form-group">
            <label>Inscrição Estadual (IE)</label>
            <input
              type="text"
              value={fiscal.stateInscription}
              onChange={(e) =>
                setFiscal({ ...fiscal, stateInscription: e.target.value })
              }
              placeholder="Ex: 123.456.789.000"
            />
          </div>

          <div className="form-group file-upload">
            <label>Certificado Digital (A1 - .pfx)</label>
            <input type="file" accept=".pfx,.p12" />
            <small>O certificado é necessário para assinar as notas fiscais.</small>
          </div>
        </section>
      </div>

      <button onClick={saveSettings} className="btn-save">
        💾 Salvar Todas as Configurações
      </button>
    </div>
  )
}
