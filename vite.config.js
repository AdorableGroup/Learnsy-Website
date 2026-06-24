import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-sw',
      closeBundle() {
        fs.copyFileSync(resolve(__dirname, 'sw.js'), resolve(__dirname, 'dist/sw.js'));
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        docx: 'docx.html',
      }
    }
  }
})
