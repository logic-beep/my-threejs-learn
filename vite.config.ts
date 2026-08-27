import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cesiumEngine } from 'vite-plugin-cesium-engine'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  let base = '/'
  if (mode === 'production' && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repoName && !repoName.endsWith('.github.io')) {
      base = `/${repoName}/`
    }
  }

  const assetsPath = 'cesium'
  const cesiumBaseUrl = `${base === '/' ? '' : base}${assetsPath}`

  return {
    base,
    plugins: [
      react(),
      cesiumEngine({
        assetsPath,
        cesiumBaseUrl,
        chunkName: 'vendor-cesium',
        debug: mode !== 'production',
      }),
    ],
    resolve: {
      alias: {
        '@zip.js/zip.js/lib/zip-no-worker.js': path.resolve(
          __dirname,
          'node_modules/@zip.js/zip.js/index.js',
        ),
      },
    },
    optimizeDeps: {
      include: ['@cesium/engine', '@cesium/widgets'],
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
