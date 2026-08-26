# 03 · 新增 Demo 指南

新增一个 Demo 需要 **3 个步骤**：新建文件 → 注册路由 → 自检。下面给出两种架构的完整模板。

## 第 1 步：在 `src/demos/` 新建组件文件

文件命名：大驼峰（PascalCase），如 `MyNewDemo.tsx`。文件头部用分隔线注释块写明用途（中文）。

### 模板 A：原生 Three.js 模式

```tsx
// ============================================================
// 我的新 Demo - 一句话说明演示内容
// 核心架构：React 状态管理 + Three.js 3D 可视化
// ============================================================

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

const MyNewDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // ---- 1. 场景 / 相机 / 渲染器 ----
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(4, 3, 6)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    // ---- 2. 轨道控制器（记得加入动画循环）----
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // ---- 3. 组装场景（灯光 + 物体）----
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(5, 10, 7)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0x404060, 0.6))

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff88 })
    const cube = new THREE.Mesh(geometry, material)
    cube.castShadow = true
    scene.add(cube)

    // ---- 4. lil-gui 调试面板（挂载 + 定位 + 清理）----
    const params = { speed: 0.01, color: '#00ff88' }
    const gui = new GUI({ title: '🛠️ 调试面板', width: 280 })
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '16px'
    gui.domElement.style.right = '16px'
    gui.domElement.style.zIndex = '9999'
    container.appendChild(gui.domElement)
    gui.add(params, 'speed', -0.1, 0.1, 0.001).name('旋转速度')
    gui.addColor(params, 'color')
      .name('颜色')
      .onChange((v) => material.color.set(v as string))

    // ---- 5. 动画循环 ----
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      cube.rotation.y += params.speed
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ---- 6. resize 处理 ----
    const handleResize = () => {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // ---- 7. 卸载清理（缺一不可）----
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
  }, [])

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas} />
      <aside style={styles.panel}>
        <h2 style={styles.title}>我的新 Demo</h2>
        <p style={styles.subtitle}>说明文字（中文）</p>
      </aside>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' },
  canvas: { flex: 1, minWidth: 0, position: 'relative' },
  panel: {
    width: 380,
    minWidth: 380,
    padding: '24px 28px',
    background: 'linear-gradient(180deg, #16213e 0%, #0f3460 100%)',
    color: '#eaeaea',
    overflowY: 'auto',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    boxSizing: 'border-box',
  },
  title: { margin: 0, fontSize: 24, fontWeight: 600, color: '#fff' },
  subtitle: { margin: '6px 0 24px', fontSize: 14, color: '#a0a0c0' },
}

export default MyNewDemo
```

### 模板 B：R3F 模式

```tsx
// ============================================================
// 我的新 Demo (R3F 版) - 一句话说明演示内容
// 核心架构：React 状态管理 + R3F 声明式 3D 可视化
// ============================================================

import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import * as THREE from 'three'

// 可交互的立方体：useFrame 驱动动画 + 指针事件
function SpinningCube() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * (hovered ? 1.6 : 0.8)
    meshRef.current.rotation.y += delta * 1.2
  })

  return (
    <mesh
      ref={meshRef}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? '#ff4466' : '#00ff88'} />
    </mesh>
  )
}

const MyNewDemoR3F = () => {
  return (
    <div style={styles.wrapper}>
      <div style={styles.canvas}>
        <Canvas shadows camera={{ position: [4, 3, 6], fov: 60 }}>
          <color attach="background" args={['#0d1117']} />
          <Environment preset="city" />
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color={0x111827} />
          </mesh>
          <Grid args={[50, 50]} cellSize={1} cellColor={0x1a2a3a} sectionSize={5} sectionColor={0x00ffff} />
          <SpinningCube />
          <OrbitControls makeDefault enableDamping />
        </Canvas>
      </div>
      <aside style={styles.panel}>
        <h2 style={styles.title}>我的新 Demo (R3F)</h2>
        <p style={styles.subtitle}>说明文字（中文）</p>
      </aside>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' },
  canvas: { flex: 1, minWidth: 0, position: 'relative' },
  panel: {
    width: 380,
    minWidth: 380,
    padding: '24px 28px',
    background: 'linear-gradient(180deg, #16213e 0%, #0f3460 100%)',
    color: '#eaeaea',
    overflowY: 'auto',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    boxSizing: 'border-box',
  },
  title: { margin: 0, fontSize: 24, fontWeight: 600, color: '#fff' },
  subtitle: { margin: '6px 0 24px', fontSize: 14, color: '#a0a0c0' },
}

export default MyNewDemoR3F
```

> R3F 模板说明：无需手动 `dispose` / `resize` / `scene.add`；`useFrame` 替代 `requestAnimationFrame`；drei 组件替代手写控制器与辅助元素。若需要 lil-gui，参照 `DigitalTwinR3F.tsx` 的 `useRef + forceTick` 模式。

## 第 2 步：在 `src/App.tsx` 注册路由（双注册，勿遗漏）

1. 顶部 `import MyNewDemo from './demos/MyNewDemo'`（命名风格：文件大驼峰，组件名可带 `Demo` 后缀）。
2. `demos` 数组添加一项，例如：
   ```ts
   { path: '/my-demo', label: '我的新 Demo' },
   ```
   > `label` 为中文侧边栏文案；`path` 建议 kebab-case。
3. 添加包装组件（沿用现有模式）：
   ```tsx
   function MyNewDemoPage() {
     return <MyNewDemo />
   }
   ```
4. `<Routes>` 中添加：
   ```tsx
   <Route path="/my-demo" element={<MyNewDemoPage />} />
   ```

## 第 3 步：自检清单

- [ ] `npm run lint` 通过（oxlint：hooks 规则、only-export-components）
- [ ] `npm run build` 通过（`tsc -b` 会拦截：未使用变量、参数、类型导入写法错误）
- [ ] 原生模式：确认清理函数齐全（rAF / gui / dispose / removeChild / resize 监听）
- [ ] R3F 模式：确认没有手写 `scene.add`、`requestAnimationFrame` 等命令式残留
- [ ] `npm run dev` 手动验证：侧边栏出现新入口、点击后页面正常渲染、无控制台报错
- [ ] 注释与 UI 文案为中文；样式走内联 `styles` 对象
