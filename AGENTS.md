# AGENTS.md — AI 辅助开发工作手册

> 本文件是 AI 编码助手（Claude Code / Codex / Cursor / Gemini CLI 等）进入本仓库后的**入口说明**。
> 只放"必须知道"的摘要；详细文档见 `docs/agents/` 目录（文末索引）。

## 项目是什么

**3j**：Three.js / React Three Fiber (R3F) 的 **WebGL 学习 Demo 集合**，附带一个"数字孪生"综合示例（原生 Three.js 版 + R3F 版双实现对照）。

- 技术栈：React 19 + TypeScript + Vite 8
- 3D：`three` ^0.185 + `@react-three/fiber` ^9 + `@react-three/drei` ^10
- 调试：`lil-gui` 面板；路由：`react-router-dom` ^7
- 特点：中文注释与中文 UI、GitHub Night 深色主题、每个 Demo 独立成文件

## 最常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（HMR） |
| `npm run build` | `tsc -b` 类型检查 + Vite 生产构建（产出 `dist/`） |
| `npm run lint` | oxlint 代码检查 |
| `npm run preview` | 本地预览构建产物 |

## 项目结构（要点）

```
src/
├── main.tsx          # 入口：createRoot + BrowserRouter（basename 取 import.meta.env.BASE_URL）
├── App.tsx           # 侧边栏导航 + 全部路由注册 —— 新增 Demo 必须同步修改这里
├── index.css         # 全局样式（侧边栏 / 主内容布局）
└── demos/            # 每个文件一个独立 Demo（原生 Three.js 或 R3F，二选一）
.github/workflows/deploy-pages.yml   # CI（tsc + build）+ GitHub Pages 部署
vite.config.ts        # 生产模式按 GITHUB_REPOSITORY 动态设置 base（GitHub Pages 子路径）
```

## 必须遵守的规则（AI 最容易踩坑的点）

1. **新增 Demo 必须"双注册"**：在 `src/demos/` 新建文件后，还要在 `src/App.tsx` 中：
   - `demos` 数组加一项 `{ path, label }`（决定侧边栏入口）；
   - `<Routes>` 中加对应 `<Route>`（可复用现有 wrapper 组件模式）。
2. **两种渲染架构二选一，不要混用**：
   - **原生 Three.js（命令式）**：`useRef` 持有 THREE 对象 → `useEffect` 一次性初始化 → `requestAnimationFrame` 动画循环 → 卸载时手动 `cancelAnimationFrame` / `geometry.dispose()` / `material.dispose()` / `renderer.dispose()` / 移除 DOM。
   - **R3F（声明式）**：`<Canvas>` + JSX 组合场景 + `useFrame` 驱动动画 + drei 组件（`OrbitControls` / `Grid` / `Environment` / `ContactShadows` 等），**无需手动生命周期管理**。
3. **lil-gui 使用规范**：调试参数集中放在 `params` 对象（或 `useRef`）；面板 `gui.domElement` 需要手动设置 `position: absolute` + `zIndex` 并挂到 DOM；组件卸载时必须 `gui.destroy()` 并 `removeChild(gui.domElement)`，否则会泄漏。
4. **中文注释**：代码注释与文件头部说明用中文；Demo 文件头部用 `// ====` 分隔线注释块写明用途与架构要点。
5. **样式用内联对象**：文件底部统一 `const styles: Record<string, React.CSSProperties> = { ... }`，不引入 CSS 文件（全局布局除外）。
6. **类型安全**：tsconfig 开启 `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax` / `erasableSyntaxOnly`；类型导入必须用 `import type`；未使用的变量/参数会导致 `tsc -b` 失败。
7. **提交前自检**：`npm run lint` 与 `npm run build` 必须通过——CI 同样执行 `tsc -b` + `npm run build`，失败会阻塞部署。
8. **路由/部署注意**：应用部署在 GitHub Pages 子路径下（base 非 `/`），所有路由跳转应使用相对路径或 `import.meta.env.BASE_URL`，不要硬编码绝对路径。

## 详细文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/agents/01-project-overview.md](docs/agents/01-project-overview.md) | 项目定位、技术栈版本、命令、运行与部署方式 |
| [docs/agents/02-architecture.md](docs/agents/02-architecture.md) | 目录结构、路由流程、两种渲染架构对比、Demo 清单 |
| [docs/agents/03-add-a-demo.md](docs/agents/03-add-a-demo.md) | 新增 Demo 的分步指南 + 原生/R3F 两种代码模板 |
| [docs/agents/04-coding-conventions.md](docs/agents/04-coding-conventions.md) | 编码规范、生命周期清理、lil-gui、数据模拟等常见模式 |
| [docs/agents/05-quality-gates.md](docs/agents/05-quality-gates.md) | oxlint / TypeScript / CI / GitHub Pages 部署的质量关卡 |
