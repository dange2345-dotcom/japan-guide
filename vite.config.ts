import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// Имя репозитория на GitHub = путь сайта на GitHub Pages (https://<user>.github.io/japan-guide/).
// Если репозиторий будет назван иначе — поменять здесь.
const BASE = '/japan-guide/'

export default defineConfig({
  base: BASE,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // theme-color задан в index.html отдельно для светлой и тёмной темы — плагин свой не добавляет.
      pwaAssets: { config: true, injectThemeColor: false },
      manifest: {
        name: 'Япония',
        short_name: 'Япония',
        description: 'Личный путеводитель по Японии: рестораны, места, магазины, отели и гайды',
        lang: 'ru',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f1ea',
        theme_color: '#f4f1ea',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // Фото мест из хранилища Supabase — один раз скачали, дальше открываются без сети.
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/jp-photos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'jp-photos',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
