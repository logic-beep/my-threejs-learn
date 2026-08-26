import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import * as cesiumPkg from 'vite-plugin-cesium'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve as pathResolve } from 'node:path'

const cesiumPlugin = (cesiumPkg as unknown as {
  default?: (opts?: object) => Plugin
  vitePluginCesium?: (opts?: object) => Plugin
}).default ?? (cesiumPkg as unknown as (opts?: object) => Plugin)

// 定位各种包的真实文件路径（兼容 Node ESM，不使用 require）
const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveFromCwd(rel: string): string {
  const fileUrl = pathToFileURL(pathResolve(__dirname, rel)).href
  const resolved = fileURLToPath(fileUrl)
  return resolved
}

// Cesium 打包后的 ESM 入口（Cesium 官方把所有 CJS 依赖都转译进这个文件了）
const CESIUM_BUNDLE_ESM = resolveFromCwd('node_modules/cesium/Build/CesiumUnminified/index.js')

// mersenne-twister 只有 module.exports，没有 ESM default 导出
const MT_PATH = resolveFromCwd('node_modules/mersenne-twister/src/mersenne-twister.js')
// urijs 也是 module.exports = URI，无 default 导出
const URIJS_PATH = resolveFromCwd('node_modules/urijs/src/URI.js')
const URIJS_UTILS_PATH = resolveFromCwd('node_modules/urijs/src/URITemplate.js')

// 统一兜底：给老式纯 module.exports = X 形式的 CJS 包
// 在源码末尾追加 `export default module.exports;`，供 `import X from "pkg"` 使用
function wrapCjsWithDefault(fsPath: string, varNameFromSource: string): string {
  const src = readFileSync(fsPath, 'utf8')
  const renamed = src
    .replace(new RegExp(`(var|function|const|let)\\s+(${varNameFromSource})\\b`, 'm'), (_m, kw, name) => `${kw} ${name}_CJS_`)
    .replace(new RegExp(`\\b${varNameFromSource}\\.prototype\\b`, 'g'), `${varNameFromSource}_CJS_.prototype`)
    .replace(new RegExp(`module\\.exports\\s*=\\s*${varNameFromSource}\\s*;`), `module.exports = ${varNameFromSource}_CJS_;`)
  return renamed + `\nexport default module.exports;\n`
}

// ==============================================================
// 核心修复插件：
// 1) cesium / @cesium/engine / @cesium/widgets 全部直接指向 Cesium 官方打包好的 ESM bundle，
//    从而绕过 Vite 8 + Rolldown 对零散 CJS 源码 (mersenne-twister / urijs 等) 的互操作问题。
// 2) 官方 bundle 只有命名导出（export { … }），缺少 default；我们用 ?cesium-default query
//    做一个虚拟层：`export * from 裸 bundle; import * as A; export default A;`
// 3) 兜底：如果直接 import mersenne-twister / urijs，则自动加 default 导出。
// ==============================================================
function cesiumCjsCompatPlugin(): Plugin {
  const RAW_QUERY = '?cesium-raw-bundle'
  const WITH_DEFAULT_QUERY = '?cesium-with-default'
  // 内部虚拟 id（用于 resolveId 阶段精准匹配）
  const CESIUM_RAW_INTERNAL = '\0__cesium_raw_bundle__'
  const CESIUM_WITH_DEFAULT_INTERNAL = '\0__cesium_with_default__'
  const MT_VIRTUAL = '\0__mersenne_twister__'
  const URI_VIRTUAL = '\0__urijs_uri__'

  return {
    name: 'cesium-cjs-compat',
    enforce: 'pre',
    resolveId(id, _importer, _opts) {
      // 已经解析成内部虚拟 ID 了，原样返回（防止二次处理）
      if (
        id === CESIUM_RAW_INTERNAL ||
        id === CESIUM_WITH_DEFAULT_INTERNAL ||
        id === MT_VIRTUAL ||
        id === URI_VIRTUAL
      ) {
        return id
      }
      // 由内部虚拟层发出的子请求（带内部 query）
      if (id.includes(RAW_QUERY)) return CESIUM_RAW_INTERNAL
      if (id.includes(WITH_DEFAULT_QUERY)) return CESIUM_WITH_DEFAULT_INTERNAL

      // 1. cesium 本体及其拆分包：统一走「补了 default 的虚拟模块」
      if (
        id === 'cesium' ||
        id.startsWith('cesium/') ||
        id === '@cesium/engine' ||
        id.startsWith('@cesium/engine/') ||
        id === '@cesium/widgets' ||
        id.startsWith('@cesium/widgets/') ||
        id === '@cesium/wasm-splats' ||
        id.startsWith('@cesium/wasm-splats/')
      ) {
        return CESIUM_WITH_DEFAULT_INTERNAL
      }
      // 2. 兜底的单个 CJS 包
      if (id === 'mersenne-twister' || id.endsWith('/mersenne-twister/src/mersenne-twister.js') || id === MT_PATH) {
        return MT_VIRTUAL
      }
      if (id === 'urijs' || id === 'URI' || id.endsWith('/urijs/src/URI.js') || id === URIJS_PATH) {
        return URI_VIRTUAL
      }
      if (id.startsWith('urijs/')) {
        const sub = id.slice('urijs/'.length)
        const local = resolveFromCwd(join('node_modules/urijs/src', sub + (sub.endsWith('.js') ? '' : '.js')))
        return local
      }
      return null
    },
    load(id) {
      // 裸 bundle：Cesium 官方 ESM，只有命名导出
      if (id === CESIUM_RAW_INTERNAL) {
        return readFileSync(CESIUM_BUNDLE_ESM, 'utf8')
      }
      // 带 default：从裸模块 re-export
      if (id === CESIUM_WITH_DEFAULT_INTERNAL) {
        return (
          `export * from ${JSON.stringify(CESIUM_RAW_INTERNAL)};\n` +
          `import * as __CesiumAll__ from ${JSON.stringify(CESIUM_RAW_INTERNAL)};\n` +
          `export default __CesiumAll__;\n`
        )
      }
      if (id === MT_VIRTUAL) {
        return wrapCjsWithDefault(MT_PATH, 'MersenneTwister')
      }
      if (id === URI_VIRTUAL) {
        return wrapCjsWithDefault(URIJS_PATH, 'URI')
      }
      if (id === URIJS_UTILS_PATH) {
        return readFileSync(id, 'utf8') + '\n'
      }
      return null
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
    plugins: [cesiumCjsCompatPlugin(), react(), cesiumPlugin()],
    optimizeDeps: {
      // cesium 直接用官方 bundle，里面所有 CJS 子依赖都已经被 rollup 转译过
      exclude: ['cesium', '@cesium/engine', '@cesium/widgets', 'mersenne-twister', 'urijs'],
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
