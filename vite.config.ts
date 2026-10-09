import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The service worker keeps the app itself on the phone, so it opens with no signal (the data is already
// on the device in IndexedDB). New versions wait until you choose to reload — never mid-form.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,          // registered in main.tsx, which shows the "update ready" bar
      manifest: false,                // public/manifest.webmanifest stays the source of truth
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,   // PDF / Excel readers are ~0.5 MB each
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          // cover photos: keep the last few so the cover works offline too
          urlPattern: ({ url }) => url.origin === 'https://images.unsplash.com',
          handler: 'CacheFirst',
          options: { cacheName: 'covers', expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
})
