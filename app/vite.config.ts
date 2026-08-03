import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'url'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle these so a late discovery (Clerk loads lazily at sign-in) never
  // re-optimizes mid-session and 404s an already-loaded chunk's dynamic import.
  optimizeDeps: {
    include: [
      'pdfjs-dist',
      'pdfjs-dist/web/pdf_viewer',
      'mammoth',
      '@clerk/clerk-react',
      '@clerk/clerk-react/internal',
      '@clerk/shared/error',
      '@clerk/shared/getEnvVariable',
      '@clerk/shared/underscore',
    ],
  },
  plugins: [
    // Disable the devtools event bus (default port 42069) to avoid port conflicts in dev environments.
    devtools({ eventBusConfig: { enabled: false } }),
    nitro({
      preset: 'vercel',
      output: {
        dir: '../.vercel/output',
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),

    tanstackStart(),
    viteReact(),
  ],
})

export default config
