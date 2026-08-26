# 05 · 质量关卡（lint / 类型 / CI / 部署）

AI 助手修改代码后，**必须保证以下关卡全部通过**，否则 CI 会失败、部署会被阻塞。

## 1. 代码检查：oxlint

配置文件：`.oxlintrc.json`

```json
{
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

运行：`npm run lint`

重点关注：

- `react/rules-of-hooks`（error）：hooks 调用顺序/条件问题会直接报错。
- `react/only-export-components`（warn）：文件只能导出组件（常量导出允许）；不要在一个 Demo 文件里额外导出非组件工具（如把 `styles` 或辅助函数 `export` 出去会触发警告）。

## 2. 类型检查：TypeScript

运行：`npx tsc -b`（`npm run build` 的第一步）

严格项（`tsconfig.app.json`）：

| 选项 | 含义 | 违规后果 |
| --- | --- | --- |
| `noUnusedLocals` / `noUnusedParameters` | 未使用变量/参数 | 编译失败 |
| `verbatimModuleSyntax` | 类型导入必须 `import type` | 编译失败 |
| `erasableSyntaxOnly` | 禁止 enum / namespace 等 | 编译失败 |
| `noFallthroughCasesInSwitch` | switch 禁止穿透 | 编译失败 |
| `moduleResolution: "bundler"` | 按 bundler 方式解析模块 | — |

> 注意：`npm run build` 与 CI 中的 `tsc -b` 是硬性关卡。**类型警告 = 构建失败**，不是黄色提示。

## 3. 构建：Vite

运行：`npm run build`（= `tsc -b && vite build`）

`vite.config.ts` 要点：

- `base`：生产模式且有 `GITHUB_REPOSITORY` 环境变量时动态设为 `/${repoName}/`（GitHub Pages 子路径）；本地/无该变量时 `/`。
- 产物目录：`js/`、`css/`、`assets/` 下带 hash 的文件名。
- 插件：仅 `@vitejs/plugin-react`。

## 4. CI 工作流：`.github/workflows/deploy-pages.yml`

触发：push 到 `main`/`master`、PR、手动 `workflow_dispatch`。

**ci job**（push 与 PR 都会跑）：

1. `actions/checkout@v4`
2. `actions/setup-node@v4`（Node 22，npm 缓存）
3. `npm ci`（按 `package-lock.json` 安装，**新增依赖后必须提交 lockfile**）
4. `npx tsc -b`（类型检查）
5. `npm run build`（注入 `GITHUB_REPOSITORY` 环境变量）
6. `cp dist/index.html dist/404.html`（SPA 路由兜底：GitHub Pages 对未匹配路径回退到 404.html，使前端路由可刷新）
7. PR 不传 artifact；push 上传 `dist-artifact`

**deploy job**（仅 push，`needs: ci`）：

1. 下载 artifact → `upload-pages-artifact` → `deploy-pages`（环境 `github-pages`）

## 5. 交付前自检清单（AI 必须执行）

```bash
npm run lint          # oxlint 无 error
npm run build         # tsc -b + vite build 成功（类型零错误）
```

额外人工检查（无法自动化）：

- 新增 Demo 已在 `App.tsx` 双注册（`demos` 数组 + `<Route>`）。
- 原生模式清理函数齐全（§04-4）；R3F 无命令式残留。
- 未引入新依赖时不动 `package.json`；若引入，`npm install --save/--save-dev` 并提交 `package-lock.json`。
- 页面在 `npm run dev` 下实际可打开、无控制台报错。
- GitHub Pages 部署注意：SPA 刷新依赖 `404.html`；路由跳转用相对路径/`BASE_URL`。

## 6. 常见 CI 失败原因速查

| 现象 | 原因 | 修复 |
| --- | --- | --- |
| `tsc -b` 失败 | 未使用变量/参数、`import` 未用 `import type` | 按 §2 修复 |
| oxlint error | hooks 规则违规 | 检查 hooks 调用顺序/条件 |
| `npm ci` 失败 | lockfile 与 package.json 不同步 | 提交最新 `package-lock.json` |
| 部署后路由刷新 404 | 缺少 `404.html` | CI 已自动复制；本地预览需手动验证 |
| 页面资源 404 | base 路径错误 | 确认 `GITHUB_REPOSITORY` 注入与 `vite.config.ts` base 逻辑 |
