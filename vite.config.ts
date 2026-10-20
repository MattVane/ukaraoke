import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// Dev HTTPS: WebCrypto (needed by Trystero) is unavailable on plain-HTTP LAN origins
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
})
