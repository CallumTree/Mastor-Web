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
        // the document readers (PDF, Excel, Word: ~1.3 MB) are only needed to import a BoQ, rate book or pack —
        // an operative's first install shouldn't download them. They're cached the first time they're used (below).
        // PDF *making* (jsPDF: certificates, dayworks, evidence) stays precached: that has to work on site with no signal.
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*.js', '**/xlsx-*.js', '**/mammoth-*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          // the readers left out of the precache: hashed file names, so once fetched they never change
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(pdf|pdf\.worker[^/]*|xlsx|mammoth)-[^/]+\.m?js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'readers', expiration: { maxEntries: 8 }, cacheableResponse: { statuses: [0, 200] } },
        }, {
          // cover photos: keep the last few so the cover works offline too
          urlPattern: ({ url }) => url.origin === 'https://images.unsplash.com',
          handler: 'CacheFirst',
          options: { cacheName: 'covers', expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // name the Word reader's chunk so the precache can leave it out (see globIgnores)
      output: { manualChunks: id => (id.includes('node_modules/mammoth') ? 'mammoth' : undefined) },
    },
  },
})
