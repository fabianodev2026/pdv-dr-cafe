import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './assets/App'
import { registerServiceWorker } from './lib/registerServiceWorker'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
