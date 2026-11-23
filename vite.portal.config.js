// Community water-information site (portal/) — its own single-file build, light enough for a phone:
//   npm run dev:portal   → http://localhost:5190
//   npm run build:portal → dist-portal/index.html (open from file://, share, or host anywhere)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: here('./portal'),
  base: './',
  plugins: [react(), viteSingleFile()],
  server: { port: 5190 },
  build: { outDir: here('./dist-portal'), emptyOutDir: true, cssCodeSplit: false, assetsInlineLimit: 100_000_000 },
})
