// ============================================================
// React Three Fiber (R3F) + drei 学习 Demo
// ------------------------------------------------------------
// 教学目标：对比"原生 three 命令式"与"R3F 声明式"的写法差异，
// 逐个展示 R3F 最常用的 6 大核心能力，并配右侧讲解面板。
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  OrbitControls,
  ContactShadows,
  Float,
  Text,
  Stars,
  Environment,
  TransformControls,
  Grid,
  Stats,
} from '@react-three/drei'
import * as THREE from 'three'
import GUI from 'lil-gui'

// ============================================================
// 1. 自定义旋转立方体组件（演示 useFrame 动画 + Pointer 事件）
//    - 对比原生：你不再需要写 requestAnimationFrame、dispose、resize
//    - 直接在组件里写 props / state / hooks
// ============================================================
function SpinningBox({
  color,
  onHoverChange,
  onClickCount,
  children,
}: {
  color: string
  onHoverChange?: (hovered: boolean) => void
  onClickCount?: (count: number) => void
  children?: React.ReactNode
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(0)

  // ---------- 每帧执行（类似原生 animate 循环，但不需要写 requestAnimationFrame）----------
  useFrame((_state, delta) => {
    if (!meshRef.current) return
    // 旋转（hover 时加速，点击后放大）
    meshRef.current.rotation.x += delta * (hovered ? 1.6 : 0.8)
    meshRef.current.rotation.y += delta * (hovered ? 2.2 : 1.2)
    // 点击时轻微放大，基于 active 次数缩放
    const targetScale = 1 + active * 0.1
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
  })

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    setHovered(true)
    onHoverChange?.(true)
  }
  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'auto'
    setHovered(false)
    onHoverChange?.(false)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setActive((a) => (a + 1) % 8)
    onClickCount?.((active + 1) % 8)
  }

  // ---------- 声明式：props 一变，对象就更新（原生需手动 material.color.set()）----------
  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshStandardMaterial
        color={hovered ? '#ffcc66' : color}
        emissive={hovered ? color : '#000000'}
        emissiveIntensity={hovered ? 0.4 : 0}
        roughness={0.35}
        metalness={0.4}
      />
      {children}
    </mesh>
  )
}

// ============================================================
// 3. 场景主体：把上面的组件组合成一个示例场景
// ============================================================
function Scene({
  guiParams,
  onHoverChange,
  onClickCount,
}: {
  guiParams: {
    boxColor: string
    bgColor: string
    envPreset: 'studio' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'city' | 'park' | 'lobby'
    showStars: boolean
    showText: boolean
    showShadows: boolean
    floatSpeed: number
    gridVisible: boolean
  }
  onHoverChange?: (hovered: boolean) => void
  onClickCount?: (count: number) => void
}) {
  return (
    <>
      {/* -------- drei: 环境光贴图（替代手写多灯打光，PBR 效果大幅提升）-------- */}
      <Environment preset={guiParams.envPreset} />

      {/* -------- drei: 星空背景（开关由 GUI 控制）-------- */}
      {guiParams.showStars && <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.5} />}

      {/* -------- 基础灯光（原生 three 需要 new + scene.add，这里声明式写进去即可）-------- */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* -------- drei: 网格地面（可通过 GUI 开关）-------- */}
      <Grid
        position={[0, -0.75, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2a3a55"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#63b3ed"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
        visible={guiParams.gridVisible}
      />

      {/* -------- drei: Float + 自定义 SpinningBox 组合 -------- */}
      <Float speed={guiParams.floatSpeed} rotationIntensity={0.4} floatIntensity={0.8}>
        <SpinningBox
          color={guiParams.boxColor}
          onHoverChange={onHoverChange}
          onClickCount={onClickCount}
        />
      </Float>

      {/* -------- 可拖动的环面纽结（演示 TransformControls）-------- */}
      <group position={[-2.8, 0.1, 0]}>
        <TransformableMesh />
      </group>

      {/* -------- 一堆小球（用 state/props 驱动颜色，演示声明式批量）-------- */}
      <InstancedSpheres />

      {/* -------- drei: Text 3D 文字（无需自己生成字体纹理）-------- */}
      {guiParams.showText && (
        <Text
          position={[0, -1.2, 0]}
          fontSize={0.3}
          color="#93c5fd"
          anchorX="center"
          anchorY="middle"
        >
          Hover 我 / Click 我 / 右键拖动 Orbit
        </Text>
      )}

      {/* -------- drei: 接触阴影（让物体"落地感"更强，性能友好）-------- */}
      {guiParams.showShadows && (
        <ContactShadows
          position={[0, -0.74, 0]}
          opacity={0.5}
          scale={12}
          blur={2.4}
          far={4}
        />
      )}

      {/* -------- drei: 轨道控制器（R3F 会自动每帧调用 update）-------- */}
      <OrbitControls
        makeDefault
        enablePan
        minDistance={3}
        maxDistance={25}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  )
}

// 为了避免 React 函数组件里不能再调用 useFrame 的问题，这里用一个新包装组件
function TransformableMesh() {
  const ref = useRef<THREE.Mesh>(null!)
  return (
    <>
      <mesh ref={ref} castShadow receiveShadow>
        <torusKnotGeometry args={[0.4, 0.14, 100, 24]} />
        <meshStandardMaterial color="#f472b6" roughness={0.25} metalness={0.6} />
      </mesh>
      <TransformControls object={ref} mode="translate" />
    </>
  )
}

// ============================================================
// 4. 批量实例化的小球（演示声明式 .map 生成 + 随机颜色）
// ============================================================
function InstancedSpheres() {
  // 8 个球按圆周排布
  const positions = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return [Math.cos(a) * 3, Math.sin(a) * 0.6 + 0.4, Math.sin(a) * 3] as [number, number, number]
  })
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#fde047']
  return (
    <group position={[0, 0, 0]}>
      {positions.map((pos, i) => (
        <Float key={i} speed={1.5 + i * 0.2} rotationIntensity={0.6} floatIntensity={0.5}>
          <mesh position={pos} castShadow>
            <sphereGeometry args={[0.22, 32, 32]} />
            <meshStandardMaterial
              color={colors[i % colors.length]}
              roughness={0.2}
              metalness={0.7}
              emissive={colors[i % colors.length]}
              emissiveIntensity={0.05}
            />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

// ============================================================
// 5. 页面主组件：Canvas 容器 + 右侧讲解面板 + lil-gui 调试
// ============================================================
const ReactThreeFiberDemo = () => {
  const [hovered, setHovered] = useState(false)
  const [clickCount, setClickCount] = useState(0)

  // 场景参数：React state 直接作为 Canvas 内 props 传入（双向绑定）
  const [, setBoxColor] = useState('#4f46e5')
  const [bgColor, setBgColor] = useState('#0b1220')

  // lil-gui 初始化（和原生 three 一样用法——但更推荐 R3F 用 useControls，
  // 这里为了和你已有的 lil-gui 使用方式保持一致，仍用 DOM 版 GUI）
  const guiParamsRef = useRef({
    boxColor: '#4f46e5',
    bgColor: '#0b1220',
    envPreset: 'studio' as
      | 'studio'
      | 'sunset'
      | 'dawn'
      | 'night'
      | 'warehouse'
      | 'forest'
      | 'apartment'
      | 'city'
      | 'park'
      | 'lobby',
    showStars: false,
    showText: true,
    showShadows: true,
    floatSpeed: 1.5,
    gridVisible: true,
  })

  // guiParamsRef 更新时，同步到 React state 让 Canvas 重新渲染
  useEffect(() => {
    const gui = new GUI({ title: '⚛️ R3F 调试面板', width: 300 })
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '16px'
    gui.domElement.style.right = '412px'
    gui.domElement.style.zIndex = '9999'
    document.body.appendChild(gui.domElement)

    const fStyle = gui.addFolder('🎨 外观')
    fStyle.addColor(guiParamsRef.current, 'boxColor').name('立方体颜色').onChange((v: string) => {
      guiParamsRef.current.boxColor = v
      setBoxColor(v)
    })
    fStyle.addColor(guiParamsRef.current, 'bgColor').name('背景色').onChange((v: string) => {
      guiParamsRef.current.bgColor = v
      setBgColor(v)
    })
    fStyle
      .add(guiParamsRef.current, 'envPreset', [
        'studio',
        'sunset',
        'dawn',
        'night',
        'warehouse',
        'forest',
        'apartment',
        'city',
        'park',
        'lobby',
      ])
      .name('环境预设')

    const fScene = gui.addFolder('🌌 场景开关')
    fScene.add(guiParamsRef.current, 'showStars').name('显示星空')
    fScene.add(guiParamsRef.current, 'showText').name('显示文字')
    fScene.add(guiParamsRef.current, 'showShadows').name('接触阴影')
    fScene.add(guiParamsRef.current, 'gridVisible').name('显示网格')
    fScene.add(guiParamsRef.current, 'floatSpeed', 0, 5, 0.1).name('浮动速度')

    return () => {
      gui.destroy()
      if (gui.domElement.parentNode) gui.domElement.parentNode.removeChild(gui.domElement)
    }
  }, [])

  // 每次渲染重新触发 Canvas 内部 re-render（最简单的 GUI → 3D 绑定）
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      // 每秒强制刷新一次 Canvas，让 GUI 的"无 onChange 类"也能生效
      // （实际上 drei 组件大部分都是响应式 props，此处为兜底）
      forceTick((t) => (t + 1) % 1000000)
    }, 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={styles.wrapper}>
      {/* --------- 左侧：3D 画布（注意：Canvas 自带渲染器/尺寸/resize，无需手动）--------- */}
      <div style={{ ...styles.canvas, background: bgColor }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [5, 4, 7], fov: 50 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
          }}
        >
          {/* color 绑定到 React state，setBgColor 就会立刻重绘背景*/}
          <color attach="background" args={[bgColor]} />
          <fog attach="fog" args={[bgColor, 10, 30]} />
          <Stats />
          <Scene
            guiParams={guiParamsRef.current}
            onHoverChange={(h) => setHovered(h)}
            onClickCount={(c) => setClickCount(c)}
          />
        </Canvas>

        {/* 3D 画布上的 2D 悬浮提示 */}
        <div style={styles.canvasTip}>
          <div style={styles.badge}>⚛️ React Three Fiber</div>
          <div style={styles.badgeSub}>
            {hovered ? '🖱️ 鼠标悬停立方体：颜色+自发光改变' : '试试把鼠标移到中心立方体上'}
          </div>
          <div style={styles.badgeSub}>点击立方体：放大次数 {clickCount} / 7</div>
        </div>
      </div>

      {/* --------- 右侧：讲解面板 --------- */}
      <aside style={styles.panel}>
        <h2 style={styles.title}>React Three Fiber 入门指南</h2>
        <p style={styles.subtitle}>
          声明式 Three.js：写 JSX 就等于写 <code>new Mesh()</code>
        </p>

        {[
          {
            title: '1️⃣ 场景：Canvas 组件',
            items: [
              'R3F 会自动创建 renderer / scene / camera，你无需手动 new THREE.WebGLRenderer',
              'props: shadows、dpr、camera、gl 完全对应原生配置',
              'Canvas 内部组件才可以用 useFrame / useThree 等 hooks',
            ],
            code: `<Canvas shadows camera={{ position:[5,4,7], fov:50 }}>
  {/* 所有 3D 对象写在这里 */}
</Canvas>`,
          },
          {
            title: '2️⃣ 声明式物体：JSX 对应原生 three',
            items: [
              '原生：scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))',
              'R3F：<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="red" /></mesh>',
              'props 改变时，R3F 内部帮你调用 material.color.set() 等 setter，无需你写',
            ],
            code: `<mesh castShadow>
  <boxGeometry args={[1.4, 1.4, 1.4]} />
  <meshStandardMaterial
    color={hovered ? '#ffc' : '#4f46e5'}
    emissive={hovered ? '#4f46e5' : '#000'}
  />
</mesh>`,
          },
          {
            title: '3️⃣ 动画：useFrame',
            items: [
              '替代 requestAnimationFrame，回调参数 (state, delta) 每秒调用约 60 次',
              '组件卸载时自动取消，无需手动 cancelAnimationFrame',
              '性能：尽量避免每帧 setState；直接操作对象 ref.current（如 rotation）',
            ],
            code: `const ref = useRef<THREE.Mesh>(null!)
useFrame((_s, delta) => {
  ref.current.rotation.y += delta * 2
})`,
          },
          {
            title: '4️⃣ 交互：Pointer 事件',
            items: [
              '原生 three 需要自己做 raycaster + 鼠标坐标转换；R3F 直接在 <mesh> 上绑事件',
              'onClick / onPointerOver / onPointerOut / onWheel 等都可用',
              '事件是 ThreeEvent，stopPropagation() 阻止穿透',
            ],
            code: `<mesh
  onClick={e => { e.stopPropagation(); setActive(a => a+1) }}
  onPointerOver={() => (document.body.style.cursor='pointer')}
/>`,
          },
          {
            title: '5️⃣ drei：官方生态组件库',
            items: [
              'OrbitControls — 无需手动 dispose/update',
              'Environment preset="sunset|studio|city" — 一键 HDRI 打光',
              'Float / ContactShadows / Text / Stars / Grid / TransformControls',
            ],
            code: `<OrbitControls makeDefault />
<Environment preset="studio" />
<ContactShadows position={[0,-0.74,0]} opacity={0.5} />
<Text fontSize={0.3} color="#93c5fd">你好</Text>
<TransformControls object={ref} mode="translate" />`,
          },
          {
            title: '6️⃣ 状态联动：React state ↔ 3D props',
            items: [
              '把 React state 当作 props 传入 Canvas 内部，变化即重绘',
              'GUI 调参的本质：onChange → setState → Canvas 内部组件 props 变更',
              '复杂动画场景，用 ref 直接操作（不 setState），避免 60fps 频繁重渲染',
            ],
            code: `const [c, setC] = useState('#4f46e5')
// GUI:
gui.addColor({c},'c').onChange(v => setC(v))
// JSX:
<meshStandardMaterial color={c} />`,
          },
        ].map((sec) => (
          <section key={sec.title} style={styles.section}>
            <h3 style={styles.sectionTitle}>{sec.title}</h3>
            <ul style={styles.list}>
              {sec.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            <pre style={styles.code}>
              <code>{sec.code}</code>
            </pre>
          </section>
        ))}

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🧪 你可以立刻做的实验</h3>
          <ol style={styles.list}>
            <li>打开右上角 ⚛️ R3F 调试面板，切换 <strong>envPreset</strong> 到 sunset / night</li>
            <li>打开「显示星空」+ 背景调成黑色，看宇宙场景</li>
            <li>点击中心立方体 7 次 → 观察它从 1.0× 放大到 1.7× 再回到 1.0×</li>
            <li>拖动 <strong>粉色环面纽结</strong>（TransformControls）——这在原生需要自己写一大坨</li>
            <li>查看左上角 FPS（drei 的 <code>&lt;Stats /&gt;</code>）</li>
          </ol>
        </section>
      </aside>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0b1220',
  },
  canvas: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    transition: 'background 0.4s ease',
  },
  canvasTip: {
    position: 'absolute',
    top: 16,
    left: 16,
    pointerEvents: 'none',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: 8,
    background: 'rgba(79, 70, 229, 0.85)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.3,
    backdropFilter: 'blur(6px)',
  },
  badgeSub: {
    marginTop: 8,
    padding: '5px 10px',
    borderRadius: 6,
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 1.7,
    backdropFilter: 'blur(4px)',
    maxWidth: 360,
  },
  panel: {
    width: '400px',
    minWidth: '400px',
    padding: '22px 26px',
    background: 'linear-gradient(180deg, #111a31 0%, #0b1329 100%)',
    color: '#e2e8f0',
    overflowY: 'auto',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    boxSizing: 'border-box',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: -0.4,
  },
  subtitle: {
    margin: '6px 0 20px',
    fontSize: 13,
    color: '#93c5fd',
  },
  section: {
    marginBottom: 18,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: 15,
    fontWeight: 600,
    color: '#60a5fa',
  },
  list: {
    margin: '6px 0 10px',
    paddingLeft: 20,
    fontSize: 12,
    lineHeight: 1.8,
    color: '#cbd5e1',
  },
  code: {
    margin: 0,
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    fontSize: 11.5,
    fontFamily: 'ui-monospace, Consolas, Menlo, monospace',
    color: '#c4b5fd',
    overflowX: 'auto',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
}

export default ReactThreeFiberDemo
