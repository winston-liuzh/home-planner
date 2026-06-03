import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 需要仓库名作为 base，Electron 需要 ./
const base = process.env.DEPLOY_TARGET === 'pages'
  ? '/home-planner/'
  : './'

export default defineConfig({
  plugins: [react()],
  base,
})
