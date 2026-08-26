# 04 · 编码规范与常见模式

## 1. 注释规范

- **全部使用中文**注释（现有代码惯例）。
- Demo 文件头部用分隔线注释块，说明：演示内容、核心架构、数据流。参考：
  ```ts
  // ============================================================
  // 数字孪生 Demo - 智能工厂实时监控与数字映射平台
  // 核心架构：React 状态管理 + Three.js 3D 可视化
  // 数据流：用户操作 / 数据模拟 → React State → stateRef → 动画循环 → 3D 场景
  // ============================================================
  ```
- 复杂组件/函数上方用 `// ---- 标题 ----` 分隔线分组（如 `// 1. 初始化场景、相机、渲染器`）。
- 关键代码行内可加 `// 为什么` 型注释（如为什么用 ref 不用 state）。

## 2. 命名规范

| 对象 | 规范 | 示例 |
| --- | --- | --- |
| Demo 文件 | 大驼峰 | `DigitalTwin.tsx` |
| 组件 | 大驼峰 | `const DigitalTwin = () => ...` |
| 路由 path | kebab-case | `/digital-twin-r3f` |
| 侧边栏 label | 中文 + 可选括号说明 | `'数字孪生 (原生 Three)'` |
| THREE 对象 ref | 语义名 + `Ref` 后缀 | `containerRef` / `sceneRef` / `meshRef` |
| 业务状态 | `machineState` 等 | `const [machineState, setMachineState] = useState<MachineState>(...)` |

## 3. 样式规范

- Demo 内样式一律用**文件底部内联对象**：
  ```ts
  const styles: Record<string, React.CSSProperties> = { wrapper: {...}, canvas: {...}, panel: {...} }
  ```
- 全局布局（侧边栏、导航）才用 `src/index.css`。
- 深色主题常用色板：
  - 背景：`#0d1117`（GitHub Night 深）、`#1a1a2e`、`#16213e`
  - 面板/卡片：`#161b22`、`#21262d`（边框）
  - 文字：`#f0f6fc`（主）、`#8b949e`（次）、`#6e7681`（弱）
  - 强调色：`#e94560`（侧边栏激活红）、`#00ff88`（教学示例绿）
- 数据卡片/进度条等可参考 `DigitalTwinR3F.tsx` 底部的 `styles` 对象。

## 4. 原生 Three.js 生命周期模式（每个 Demo 都要遵守）

**初始化**（`useEffect` 内，依赖 `[]`）：

```ts
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(fov, width / height, near, far)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
container.appendChild(renderer.domElement)
```

**动画循环**：

```ts
let animationId: number
const animate = () => {
  animationId = requestAnimationFrame(animate)
  // ...更新...
  renderer.render(scene, camera)
}
animate()
```

**卸载清理（清理函数必须齐全）**：

```ts
return () => {
  window.removeEventListener('resize', handleResize)
  cancelAnimationFrame(animationId)
  controls.dispose()
  gui.destroy()
  if (gui.domElement.parentNode) gui.domElement.parentNode.removeChild(gui.domElement)
  geometry.dispose()
  material.dispose()
  renderer.dispose()
  if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
    containerRef.current.removeChild(renderer.domElement)
  }
}
```

> 常见遗漏：`gui` 只 `destroy()` 不 `removeChild`（面板残留）；`renderer.domElement` 不移除（重复挂载）；`controls.dispose()` 缺失。

## 5. lil-gui 使用模式

- 调试参数集中放 `params` 对象；控件用 `gui.addFolder('🎬 标题')` 分组，名称用中文 `name('中文名')`。
- 面板必须手动定位并挂载：
  ```ts
  const gui = new GUI({ title: '🛠️ 标题', width: 280 })
  gui.domElement.style.position = 'absolute'
  gui.domElement.style.top = '16px'
  gui.domElement.style.right = '16px'   // 或按需调整，避开右侧面板
  gui.domElement.style.zIndex = '9999'
  container.appendChild(gui.domElement) // 或 document.body.appendChild(...)
  ```
- 面板位置避让：右侧有信息面板的 Demo 将 GUI 放到 `right: '412px'`（参考 `DigitalTwinR3F.tsx`）。
- R3F 场景中参数与 React 状态联动的两种做法：
  1. 带 `onChange` 直接 setState（颜色/背景等）；
  2. 无 `onChange` 的动画参数：存 `useRef` + 每 500ms `forceTick` 强制刷新（参考 `DigitalTwinR3F.tsx` 的 `tweakParamsRef` + `sceneParamsRef`）。

## 6. 数据模拟模式（数字孪生类 Demo）

- `setInterval` 每秒更新传感器数据，`setMachineState((prev) => {...})` 函数式更新保证不依赖陈旧状态。
- 阈值判定：`warnThresh` / `errThresh` 存 `useRef`，推导 `'normal' | 'warning' | 'error'` 状态等级。
- 状态变化时写日志：`addLog('设备状态变更: xxx', type)`；日志用 `useCallback` 包裹，最多保留 8 条。
- 数据基线随 `running` / `speed` 变化（如 `baseTemp = prev.running ? 55 + prev.speed * 25 : 25`），加随机扰动并 clamp 到合理区间。

## 7. R3F 模式要点

- `useFrame((state, delta) => ...)`：`delta` 用于帧率无关动画；`state.clock.getElapsedTime()` 取累计时间。
- `useRef<THREE.Mesh>(null!)`：非空断言，避免每次判空；但使用前仍建议 `if (ref.current)` 防御。
- 事件：`onPointerOver` / `onPointerOut` / `onClick`，记得 `e.stopPropagation()`；`ThreeEvent<PointerEvent>` 类型来自 `@react-three/fiber`。
- drei 常用组件：`OrbitControls`（`makeDefault` + `enableDamping`）、`Grid`、`Environment preset="warehouse"`、`ContactShadows`、`Stats`、`Float`、`Text`、`TransformControls`。
- Canvas 属性：`shadows`、`dpr={[1, 2]}`、`camera={{ position, fov, near, far }}`、`onCreated` 中设置色调映射（`gl.toneMapping = THREE.ACESFilmicToneMapping`）。

## 8. TypeScript 严格性提示

tsconfig（`tsconfig.app.json`）开启了以下选项，违反会导致 `tsc -b` 失败：

- `noUnusedLocals` / `noUnusedParameters`：未使用的变量/参数直接报错。
- `verbatimModuleSyntax`：**类型导入必须用 `import type`**（如 `import type { ThreeEvent } from '@react-three/fiber'`）。
- `erasableSyntaxOnly`：不允许 enum 等需要运行时转换的语法（项目里用联合类型 `type X = 'a' | 'b'` 代替 enum）。
- `allowImportingTsExtensions`：源码内导入可带 `.tsx` 后缀（如 `import App from './App.tsx'`）。

## 9. 常见陷阱

1. 修改 `App.tsx` 忘记同步 `demos` 数组或 `<Route>` → 新 Demo 无入口或 404。
2. 原生模式把 THREE 对象放进 `useState` → 无谓重渲染；应放 `useRef`。
3. `useEffect` 依赖数组为空却读取外部状态 → 闭包陈旧值；用 `stateRef` 镜像或 `useCallback` 依赖。
4. 卸载时泄漏：rAF 未取消 / GUI 未销毁 / 几何体材质未 dispose（参考 §4）。
5. 在 R3F 组件里写命令式 `scene.add` / `requestAnimationFrame` → 架构混用。
6. 硬编码 `/xxx` 绝对路径跳转 → GitHub Pages 子路径下失效（用相对路径或 `import.meta.env.BASE_URL`）。
7. lil-gui 面板被侧边栏遮挡 → 检查 `zIndex` 与 `right` 偏移。
