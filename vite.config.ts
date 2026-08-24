import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

function spaGitHubPagesPlugin(base: string): Plugin {
  const normalizedBase = base.endsWith('/') ? base : base + '/'
  let outDir = 'dist'

  const restoreScript = `<script>(function(){var r=sessionStorage.getItem('spa-redirect-url');if(r){sessionStorage.removeItem('spa-redirect-url');var h=r.indexOf('#');if(h!==-1){var t=r.slice(h+1);if(t&&t!=='/'){window.history.replaceState(null,'',t)}}}})();</script>`

  return {
    name: 'spa-github-pages',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    transformIndexHtml(html) {
      return html.replace('<!-- SPA_ROUTE_RESTORE_SCRIPT -->', restoreScript)
    },
    writeBundle() {
      const redirectScript = `<script>(function(){var b='${normalizedBase}'.replace(/\\/+$/,'/');var l=window.location;sessionStorage.setItem('spa-redirect-url',b+'#'+l.pathname.slice(b.length)+l.search+l.hash);l.replace(b)})();</script>`

      const notFoundHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Redirecting...</title>${redirectScript}</head><body></body></html>`

      try {
        const distPath = resolve(process.cwd(), outDir)
        if (!existsSync(distPath)) {
          mkdirSync(distPath, { recursive: true })
        }
        writeFileSync(resolve(distPath, '404.html'), notFoundHtml, 'utf-8')
      } catch (err) {
        console.error('[spa-github-pages] 写入 404.html 失败:', err)
      }
    },
  }
}

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
    plugins: [react(), spaGitHubPagesPlugin(base)],
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
