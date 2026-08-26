# 01 · 项目概览

## 1. 项目定位

**3j** 是一个 Three.js / React Three Fiber 的 **WebGL 学习 Demo 集合**。每个 Demo 独立成文件，演示 3D 可视化的一个知识点；其中「数字孪生」是综合示例，用**原生 Three.js** 与 **R3F（React Three Fiber）** 各实现一遍，方便对照两种架构的写法差异。

- 界面语言：中文（注释、标题、UI 文案均为中文）
- 视觉风格：GitHub Night 深色主题（`#0d1117` / `#1a1a2e` / `#16213e` 等）
- 部署目标：GitHub Pages（子路径部署，见 §5）

## 2. 技术栈与版本

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `react` / `react-dom` | ^19.2 | UI 框架 |
| `three` | ^0.185 | WebGL 3D 引擎（原生模式） |
| `@react-three/fiber` | ^9.7 | React 声明式 Three.js（R3F 模式） |
| `@react-three/drei` | ^10.7 | R3F 生态组件（OrbitControls / Grid / Environment 等） |
| `@types/three` | ^0.185 | three 类型定义 |
| `lil-gui` | ^0.21 | 调试参数面板 |
| `react-router-dom` | ^7.18 | 路由（侧边栏切换 Demo） |
| `typescript` | ~6.0 | 类型检查（`tsc -b`） |
| `vite` | ^8.2 | 构建与开发服务器 |
| `@vitejs/plugin-react` | ^6.0 | React 插件（基于 Oxc） |
| `oxlint` | ^1.75 | 代码检查 |

## 3. 常用命令

```bash
npm run dev       # 启动开发服务器（HMR）
npm run build     # tsc -b && vite build → 产出 dist/
npm run lint      # oxlint 检查
npm run preview   # 预览 dist/ 构建产物
```

> 注意：`npm run build` 会先跑 TypeScript 项目引用编译（`tsc -b`），**类型错误会直接导致构建失败**，不是仅警告。

## 4. 本地运行

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的地址（默认 `http://localhost:5173`），会默认重定向到 `/digital-twin`（原生 Three.js 数字孪生）。左侧边栏可切换到全部 11 个 Demo。

## 5. 部署（GitHub Pages）

- CI 工作流：`.github/workflows/deploy-pages.yml`，push 到 `main`/`master` 或 PR 时触发。
- 流程：`npm ci` → `tsc -b`（类型检查）→ `npm run build` → 复制 `dist/index.html` 为 `dist/404.html`（SPA 路由兜底）→ 上传 Pages artifact → 部署。
- 子路径支持：`vite.config.ts` 在 `mode === 'production'` 且存在 `GITHUB_REPOSITORY` 环境变量时，把 `base` 设为 `/${repoName}/`（仓库名不是 `<user>.github.io` 时），因此线上 URL 形如 `https://<user>.github.io/<repo>/`。

## 6. 需要知道的现状

- `LoadModel.tsx` 中的 `GLTFLoader` / `DRACOLoader` 导入被注释掉，当前用**程序化生成**的机器人模型演示加载流程；如需真实加载 GLTF 模型，需取消注释并准备模型资源。
- `public/` 目录当前为空；`index.html` 引用了 `./favicon.svg`（由 Vite 默认提供，无自定义 favicon 文件时不影响构建）。
- `README.md` 仍是 Vite 模板默认内容，尚未描述本项目实际功能（本文档可作为 AI 助手了解项目的权威来源）。
