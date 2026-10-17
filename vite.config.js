import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Slip Tracker',
        short_name: 'Slip',
        description: 'A mood and habit tracker for daily check-ins.',
        theme_color: '#111827',
        background_color: '#f5f5f3',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
