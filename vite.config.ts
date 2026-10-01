import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Evita CORS em dev: o navegador vê /api/catalog como mesma origem, e o
    // Vite repassa a chamada pro Worker por fora do navegador. Só ativa se
    // VITE_PUBLIC_QUERY_API_URL=/api/catalog estiver em .env.local.
    proxy: {
      '/api/catalog': {
        target: 'https://tech-2d-consultas.tech-2d-auth-email.workers.dev',
        changeOrigin: true,
      },
    },
  },
  test: {
    // Os testes sempre usam a URL absoluta de catalogTransport.ts, mesmo que
    // o .env.local de alguém tenha o proxy de dev configurado — senão os
    // testes passam a depender do que cada pessoa tem salvo localmente.
    env: { VITE_PUBLIC_QUERY_API_URL: '' },
  },
})
