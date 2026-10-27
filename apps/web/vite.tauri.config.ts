import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      prerender: {
        enabled: true,
        filter: (page) => page.path === '/',
      },
      tsr: { appDirectory: 'src' },
    }),
    viteReact(),
  ],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  environments: {
    client: { build: { outDir: 'dist-tauri/client' } },
    ssr: { build: { outDir: 'dist-tauri/server' } },
  },
})
