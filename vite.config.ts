import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'favicon.png', 'icon.svg', 'pwa-*.png'],
          manifest: {
            name: 'מערכת CRM לניהול לקוחות',
            short_name: 'CRM',
            description: 'מערכת CRM לניהול לקוחות ומשימות',
            theme_color: '#2f8f74',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            lang: 'he',
            dir: 'rtl',
            icons: [
              {
                src: 'pwa-72x72.png',
                sizes: '72x72',
                type: 'image/png',
              },
              {
                src: 'pwa-96x96.png',
                sizes: '96x96',
                type: 'image/png',
              },
              {
                src: 'pwa-128x128.png',
                sizes: '128x128',
                type: 'image/png',
              },
              {
                src: 'pwa-144x144.png',
                sizes: '144x144',
                type: 'image/png',
              },
              {
                src: 'pwa-152x152.png',
                sizes: '152x152',
                type: 'image/png',
              },
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: 'pwa-384x384.png',
                sizes: '384x384',
                type: 'image/png',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            importScripts: ['/notification-sw.js'],
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
