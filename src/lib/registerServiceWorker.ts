export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => {
          // PWA update should never block normal PDV usage.
        })
      })
      .catch(() => {
        // PWA install should never block normal PDV usage.
      })
  })
}
