import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { restoreGuest } from './guest'
import { initIdentity } from './profile'
import { getState, hydrate } from './store'

hydrate()
if (!getState()) restoreGuest()

initIdentity().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
