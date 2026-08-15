import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'src',
          filename: 'sw.ts',
          registerType: 'autoUpdate',
          injectManifest: {
            maximumFileSizeToCacheInBytes: 6000000,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}']
          },
          manifest: {
            name: 'Next',
            short_name: 'Next',
            theme_color: '#ffffff',
            background_color: '#f0f2f5',
            display: 'standalone',
            start_url: '/',
            share_target: {
              action: "/create-post",
              method: "GET",
              params: {
                title: "title",
                text: "text",
                url: "url"
              }
            },
            icons: [
              { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
              { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png" },
              { "src": "maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
