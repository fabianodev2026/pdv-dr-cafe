const { app, BrowserWindow } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Dr. Café - PDV',
    autoHideMenuBar: true, // Isso esconde aquela barra de menu (File, Edit...)
    icon: './public/favicon.ico', // Se você tiver um ícone, ele aparece aqui
    webPreferences: {
      nodeIntegration: true,
    },
  })

  // AQUI ESTÁ O PULO DO GATO:
  // Ele vai carregar o link que acabamos de colocar no ar!
  win.loadURL('https://fabianodev2026.github.io/pdv-dr-cafe/')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
