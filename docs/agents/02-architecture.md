# 02 · 架构与目录结构

## 1. 目录结构

```
3j/
├── index.html                 # HTML 入口（lang="zh-CN"）
├── vite.config.ts             # Vite 配置：React 插件 + GitHub Pages 动态 base + 产物目录
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── .oxlintrc.json             # oxlint 配置（react / typescript / oxc 插件）
├── .github/workflows/deploy-pages.yml   # CI + 部署
├── public/                    # 静态资源（当前为空）
└── src/
    ├── main.tsx               # 入口：createRoot + StrictMode + BrowserRouter
    ├── App.tsx                # 侧边栏导航 + 全部路由注册（改动最频繁的文件之一）
    ├── index.css              # 全局样式：布局、侧边栏、导航链接
    ├── assets/                # hero.png / react.svg / vite.svg
    └── demos/                 # 11 个独立 Demo（见 §3 清单）
```

## 2. 路由流程

```
main.tsx
  └─ BrowserRouter basename={import.meta.env.BASE_URL 去掉末尾斜杠}
       └─ App
            ├─ <aside> 侧边栏：demos 数组 map 出 NavLink（isActive 高亮）
            └─ <main> <Routes>
                 ├─ path="/"           → <Navigate to="/digital-twin" replace />
                 ├─ path="/digital-twin"     → DigitalTwin（原生 Three.js）
                 ├─ path="/digital-twin-r3f" → DigitalTwinR3F（R3F 版）
                 ├─ path="/r3f"        → ReactThreeFiberDemo
                 ├─ path="/basic"      → BasicScene
                 ├─ ...（共 11 条）
```

关键点：

- **`demos` 数组**（`App.tsx` 顶部）是侧边栏的唯一数据源：`{ path, label }`。
- 每个 Demo 配了一个薄包装组件（如 `function BasicDemo() { return <BasicScene /> }`），新增路由时沿用此模式即可。
- `basename` 取自 `import.meta.env.BASE_URL`，与 `vite.config.ts` 的 `base` 联动，保证 GitHub Pages 子路径下路由正常。

## 3. Demo 清单

| 文件 | 行数 | 主题 | 架构 | 亮点 |
| --- | --- | --- | --- | --- |
| `BasicScene.tsx` | 243 | 基础场景 | 原生 | Scene/Camera/Renderer 三要素 + lil-gui |
| `Geometries.tsx` | 192 | 几何体 | 原生 | 多种 BufferGeometry |
| `MaterialsTextures.tsx` | 473 | 材质与纹理 | 原生 | 材质切换 + CanvasTexture 程序化棋盘纹理 |
| `LightingShadows.tsx` | 587 | 光照与阴影 | 原生 | 四种光源开关 + 阴影配置 |
| `AnimationInteraction.tsx` | 644 | 动画与交互 | 原生 | 旋转/漂浮/公转三种动画 + Raycaster 点击 |
| `ParticleSystem.tsx` | 383 | 粒子系统 | 原生 | BufferGeometry 粒子 + PointsMaterial |
| `Shaders.tsx` | 616 | 着色器 | 原生 | GLSL 顶点/片元着色器 + 4 种预设切换 |
| `LoadModel.tsx` | 862 | 模型加载 | 原生 | 程序化机器人 + 加载进度 UI（GLTFLoader 已注释） |
| `DigitalTwin.tsx` | 1305 | 数字孪生 | 原生 | 设备/传送带/货架 + 实时数据模拟 + 日志 |
| `DigitalTwinR3F.tsx` | 1363 | 数字孪生（R3F） | R3F | 与上者业务逻辑一致的 R3F 声明式重写 |
| `ReactThreeFiberDemo.tsx` | 589 | R3F + drei 学习 | R3F | Canvas/useFrame/drei 六大能力演示 |

## 4. 两种渲染架构对比（本项目的核心设计）

### 4.1 原生 Three.js（命令式）—— 参考 `DigitalTwin.tsx` / `BasicScene.tsx`

```
useRef 持有 THREE 对象（container/scene/renderer/frameId/各 mesh）
   ↓
useEffect 一次性初始化：new Scene / Camera / Renderer → 组装场景 → 启动 rAF
   ↓
requestAnimationFrame 循环：读 stateRef → 更新动画 → renderer.render()
   ↓
window resize 监听：更新 camera.aspect + renderer.setSize
   ↓
卸载清理：cancelAnimationFrame / gui.destroy / geometry.dispose /
          material.dispose / renderer.dispose / removeChild(domElement)
```

- 业务状态用 `useState`（参与 UI 渲染），动画可读状态用 `useRef` 镜像（`stateRef`），避免闭包陈旧值。
- 所有 Three.js 对象**不进入 React 渲染树**。

### 4.2 R3F（声明式）—— 参考 `DigitalTwinR3F.tsx` / `ReactThreeFiberDemo.tsx`

```
<Canvas shadows camera={{...}} gl={{...}} onCreated={...}>
  <color attach="background" />  <fog attach="fog" />
  <Environment preset="warehouse" />
  <ambientLight /> <directionalLight castShadow />
  <OrbitControls makeDefault /> <Grid /> <ContactShadows /> <Stats />
  <Machine />  <Conveyor />  <ConveyorBoxes />  <Rack />
</Canvas>
```

- **JSX 即场景**：不再手写 `scene.add` / `dispose` / `resize`，R3F 自动管理。
- 每帧动画用 `useFrame((state, delta) => ...)` 钩子；`state.clock.getElapsedTime()` 取时间。
- 需要操纵的对象用 `useRef<THREE.Mesh>(null!)` 挂到 `ref` 上。
- 灯光/材质等属性可用 dash-case 直接传：`shadow-mapSize={[2048, 2048]}`、`emissiveIntensity={0.8}`。
- drei 组件（`OrbitControls` / `Environment` / `Grid` / `ContactShadows` / `Stats`）开箱即用。

### 4.3 选择建议

| 需求 | 推荐 |
| --- | --- |
| 学习 Three.js 底层 API / 精细控制渲染管线 | 原生模式 |
| 与 React 状态深度耦合、团队协作、快速迭代 | R3F 模式 |
| 展示同一业务（如数字孪生）的对照教学 | 两种都写（现有做法） |

> 规则：**单个 Demo 文件内二选一，不混用**两种写法。

## 5. 数据流模式（数字孪生示例）

```
用户操作（按钮/滑块/ lil-gui）
        │
        ▼
React useState（machineState：running/speed/temperature/...）
        │
        ├─► UI 层：数据卡片 / 状态徽章 / 日志列表（直接渲染）
        └─► 3D 层：
             原生：stateRef 镜像 → rAF 循环读取 → 更新 mesh 属性
             R3F ：props 传入组件 → useFrame 读取 → 更新 ref 对象
```

- 数据模拟：`setInterval` 每秒更新传感器数值（温度/压力/转速/效率），并按阈值（warning/error）推导状态等级，状态变化时写入日志。
- lil-gui 调试参数与 React 状态分离：原生版存 `params` 对象，R3F 版存 `useRef` + 500ms 强制刷新 tick，保证无 `onChange` 的参数也能生效。
