<script setup>
import { ref } from 'vue'

// Variáveis para guardar os dados da Impressora
const printer = ref({
  connectionType: 'usb',
  ipAddress: '',
  paperWidth: '80mm',
  autoPrint: true,
})

// Variáveis para guardar os dados Fiscais (NFC-e)
const fiscal = ref({
  cnpj: '',
  stateInscription: '',
  environment: 'homologacao', // Homologação (Testes) ou Produção (Valendo)
  certificateName: '',
})

// Variável para mostrar a mensagem de sucesso
const showSuccessMsg = ref(false)

const saveSettings = () => {
  // No futuro, isso salvará na tabela 'settings' do Supabase
  console.log('Salvando Impressora:', printer.value)
  console.log('Salvando Fiscal:', fiscal.value)

  // Mostra a mensagem verde de sucesso por 3 segundos
  showSuccessMsg.value = true
  setTimeout(() => {
    showSuccessMsg.value = false
  }, 3000)
}
</script>

<template>
  <div class="settings-manager">
    <header class="header">
      <h1 class="title">Configurações do Sistema</h1>
    </header>

    <div v-if="showSuccessMsg" class="alert success">✓ Configurações salvas com sucesso!</div>

    <div class="settings-grid">
      <section class="settings-panel">
        <h2>🖨️ Configuração de Impressora</h2>

        <div class="form-group">
          <label>Tipo de Conexão</label>
          <select v-model="printer.connectionType">
            <option value="usb">Cabo USB</option>
            <option value="network">Rede / Wi-Fi (IP)</option>
            <option value="bluetooth">Bluetooth</option>
          </select>
        </div>

        <div class="form-group" v-if="printer.connectionType === 'network'">
          <label>Endereço IP da Impressora</label>
          <input type="text" v-model="printer.ipAddress" placeholder="Ex: 192.168.1.100" />
        </div>

        <div class="form-group">
          <label>Tamanho da Bobina</label>
          <select v-model="printer.paperWidth">
            <option value="80mm">80mm (Padrão)</option>
            <option value="58mm">58mm (Pequena)</option>
          </select>
        </div>

        <div class="form-group checkbox-group">
          <input type="checkbox" id="auto-print" v-model="printer.autoPrint" />
          <label for="auto-print">Imprimir recibo automaticamente após fechar a comanda</label>
        </div>
      </section>

      <section class="settings-panel">
        <h2>🧾 Configuração Fiscal (NFC-e)</h2>

        <div class="form-group">
          <label>Ambiente da Sefaz</label>
          <select v-model="fiscal.environment">
            <option value="homologacao">Homologação (Ambiente de Testes)</option>
            <option value="producao">Produção (Valendo de verdade)</option>
          </select>
        </div>

        <div class="form-group">
          <label>CNPJ da Empresa</label>
          <input type="text" v-model="fiscal.cnpj" placeholder="00.000.000/0000-00" />
        </div>

        <div class="form-group">
          <label>Inscrição Estadual (IE)</label>
          <input type="text" v-model="fiscal.stateInscription" placeholder="Ex: 123.456.789.000" />
        </div>

        <div class="form-group file-upload">
          <label>Certificado Digital (A1 - .pfx)</label>
          <input type="file" accept=".pfx,.p12" />
          <small>O certificado é necessário para assinar as notas fiscais.</small>
        </div>
      </section>
    </div>

    <div class="action-footer">
      <button @click="saveSettings" class="btn-save">Salvar Todas as Configurações</button>
    </div>
  </div>
</template>

<style scoped>
.settings-manager {
  color: #3e2723;
  background-color: #fafafa;
  padding: 20px;
  min-height: 100vh;
}
.header {
  border-bottom: 2px solid #5d4037;
  margin-bottom: 30px;
  padding-bottom: 15px;
}
.title {
  font-size: 2em;
  font-weight: 300;
  text-align: center;
}

.alert.success {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #c8e6c9;
  margin-bottom: 20px;
  font-weight: bold;
  text-align: center;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.settings-panel {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}
.settings-panel h2 {
  color: #5d4037;
  border-bottom: 1px solid #d7ccc8;
  padding-bottom: 10px;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 400;
  font-size: 1.3em;
}

.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: #4e342e;
}
.form-group input[type='text'],
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #d7ccc8;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1em;
  color: #3e2723;
  background-color: #fff;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.checkbox-group input {
  width: 20px;
  height: 20px;
  accent-color: #5d4037;
}
.checkbox-group label {
  font-weight: normal;
  margin-bottom: 0;
  cursor: pointer;
}

.file-upload input {
  border: 1px dashed #d7ccc8;
  padding: 15px;
  width: 100%;
  box-sizing: border-box;
  border-radius: 4px;
  background-color: #fcfcfc;
  cursor: pointer;
}
.file-upload small {
  display: block;
  color: #795548;
  margin-top: 5px;
  font-size: 0.85em;
}

.action-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #d7ccc8;
  padding-top: 20px;
}
.btn-save {
  background-color: #388e3c;
  color: #fff;
  border: none;
  padding: 15px 30px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1.1em;
  transition: background-color 0.2s;
}
.btn-save:hover {
  background-color: #2e7d32;
}
</style>
