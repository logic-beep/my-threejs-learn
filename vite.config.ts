import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as cesiumPkg from 'vite-plugin-cesium'

const cesiumPlugin = (cesiumPkg as unknown as {
  default?: (opts?: object) => unknown
  vitePluginCesium?: (opts?: object) => unknown
}).default ?? (cesiumPkg as unknown as (opts?: object) => unknown)

export default defineConfig(({ mode }) => {
  let base = '/'
  if (mode === 'production' && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repoName && !repoName.endsWith('.github.io')) {
      base = `/${repoName}/`
    }
  }

  return {
    base,
    plugins: [react(), cesiumPlugin() as never],
    optimizeDeps: {
      exclude: ['cesium'],
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || ''
            if (/\.(css)$/.test(name)) {
              return 'css/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
  }
})
