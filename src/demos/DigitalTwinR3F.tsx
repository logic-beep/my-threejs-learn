// ============================================================
// 数字孪生 Demo (R3F 版) - 智能工厂实时监控与数字映射平台
// 核心架构：React 状态管理 + R3F 声明式 3D 可视化
// 对比原生版优势：无需手动 dispose/resize/scene.add，JSX 即场景
// ============================================================

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  ContactShadows,
  Stats,
  Environment,
} from '@react-three/drei'
import * as THREE from 'three'
import GUI from 'lil-gui'

// ------------------------------------------------------------
// 设备状态接口 - 与原生版完全一致，业务逻辑复用
// ------------------------------------------------------------
interface MachineState {
  running: boolean
  speed: number
  temperature: number
  pressure: number
  rpm: number
  efficiency: number
  status: 'normal' | 'warning' | 'error'
  power: number
  output: number
}

// ------------------------------------------------------------
// 1. 单台设备组件：R3F 声明式替代 createMachine() 函数
//    - 用 useRef 拿到需要动画的对象
//    - 用 useFrame 替代 traverse + userData 打标签
// ------------------------------------------------------------
function Machine({
  position,
  color,
  index,
  state,
  tweak,
}: {
  position: [number, number, number]
  color: number
  index: number
  state: MachineState
  tweak: {
    ringSpeed: number
    ringPulseFreq: number
    ringPulseAmp: number
    ringRingBaseEmissive: number
    ringStopDim: number
    errorBlinkFreq: number
    errorBlinkOpacity: number
    errorBlightLight: number
    warnBlinkFreq: number
    warnBlinkOpacity: number
    warnBlightLight: number
    normalGlowOpacity: number
    vibFreq: number
    vibAmp: number
  }
}) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const ringMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const groupRef = useRef<THREE.Group>(null!)

  // 每帧动画：旋转环、警示灯闪烁、设备振动
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()

    // 旋转环
    if (ringRef.current && ringMatRef.current) {
      if (state.running) {
        ringRef.current.rotation.z += state.speed * tweak.ringSpeed
      }
      const pulse = 0.8 + Math.sin(elapsed * tweak.ringPulseFreq + index) * tweak.ringPulseAmp
      ringMatRef.current.emissiveIntensity =
        tweak.ringRingBaseEmissive + pulse * tweak.ringPulseAmp * (state.running ? 1 : tweak.ringStopDim)
    }

    // 警示灯
    if (glowMatRef.current && lightRef.current) {
      if (state.status === 'error') {
        const blink = Math.sin(elapsed * tweak.errorBlinkFreq) > 0 ? 1 : 0
        glowMatRef.current.opacity = blink * tweak.errorBlinkOpacity
        lightRef.current.intensity = blink * tweak.errorBlightLight
      } else if (state.status === 'warning') {
        const blink = Math.sin(elapsed * tweak.warnBlinkFreq) > 0 ? 1 : 0
        glowMatRef.current.opacity = blink * tweak.warnBlinkOpacity
        lightRef.current.intensity = blink * tweak.warnBlightLight
        lightRef.current.color.setHex(0xffaa00)
        glowMatRef.current.color.setHex(0xffaa00)
      } else {
        glowMatRef.current.opacity = tweak.normalGlowOpacity
        lightRef.current.intensity = 0
      }
    }

    // 设备振动
    if (groupRef.current && state.running) {
      groupRef.current.position.y =
        position[1] + Math.sin(elapsed * tweak.vibFreq + index * 2) * tweak.vibAmp * state.speed
    }
  })

  // 4 台设备颜色数组（按编号取）
  const btnColors = [0x00ff88, 0xffaa00, 0xff4444]

  return (
    <group ref={groupRef} position={position}>
      {/* 底座 */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 1, 4]} />
        <meshStandardMaterial color={0x1f2937} roughness={0.5} metalness={0.8} />
      </mesh>

      {/* 机身 */}
      <mesh position={[0, 2.25, 0]} castShadow>
        <boxGeometry args={[3.2, 2.5, 3.2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* 控制面板 */}
      <mesh position={[0, 2.5, 1.61]}>
        <boxGeometry args={[2.8, 1.5, 0.1]} />
        <meshStandardMaterial
          color={0x0a0a0a}
          emissive={0x001133}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* 旋转环 */}
      <mesh
        ref={ringRef}
        position={[0, 3.8, 1.65]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.8, 0.15, 16, 48]} />
        <meshStandardMaterial
          ref={ringMatRef}
          color={0x00ffff}
          emissive={0x00ffff}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* 3 个按钮：绿/黄/红 */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-0.8 + i * 0.8, 1.8, 1.66]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
          <meshStandardMaterial
            color={btnColors[i]}
            emissive={btnColors[i]}
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}

      {/* 左右管道 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[1.8 * side, 3, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.2, 0.2, 3, 16]} />
          <meshStandardMaterial color={0x6b7280} roughness={0.4} metalness={0.9} />
        </mesh>
      ))}

      {/* 警示灯光源 */}
      <pointLight
        ref={lightRef}
        color={0xff4400}
        intensity={0}
        distance={10}
        position={[0, 4.5, 0]}
      />

      {/* 警示灯发光球壳 */}
      <mesh ref={glowRef} position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color={0xff4400}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------
// 2. 传送带系统组件
// ------------------------------------------------------------
function Conveyor({
  state,
  rollerSpeed,
}: {
  state: MachineState
  rollerSpeed: number
}) {
  const rollersRef = useRef<THREE.Mesh[]>([])

  useFrame(() => {
    if (state.running) {
      rollersRef.current.forEach((roller) => {
        roller.rotation.x += state.speed * rollerSpeed
      })
    }
  })

  // 滚筒位置数组：-12 到 12 每 1.5 一根
  const rollerPositions = useMemo(
    () => Array.from({ length: 17 }, (_, i) => -12 + i * 1.5),
    []
  )
  // 支腿位置数组：-13 到 13 每 2 一根
  const legPositions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => -13 + i * 2),
    []
  )

  return (
    <group>
      {/* 皮带表面 */}
      <mesh position={[0, 1.15, 0]} receiveShadow>
        <boxGeometry args={[26, 0.3, 2]} />
        <meshStandardMaterial color={0x111827} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* 金属框架 */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[26.4, 0.5, 2.4]} />
        <meshStandardMaterial color={0x374151} roughness={0.5} metalness={0.8} />
      </mesh>

      {/* 支腿：左右各一排 */}
      {legPositions.map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.25, -1.2]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial color={0x4b5563} roughness={0.6} metalness={0.7} />
          </mesh>
          <mesh position={[x, 0.25, 1.2]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial color={0x4b5563} roughness={0.6} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* 滚筒 */}
      {rollerPositions.map((x, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) rollersRef.current[i] = el
          }}
          position={[x, 1, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.2, 0.2, 2.1, 12]} />
          <meshStandardMaterial color={0x6b7280} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------------------
// 3. 传送带上循环移动的货物箱
// ------------------------------------------------------------
function ConveyorBoxes({
  state,
  boxSpeed,
  boxEmissiveFreq,
  boxEmissiveAmp,
}: {
  state: MachineState
  boxSpeed: number
  boxEmissiveFreq: number
  boxEmissiveAmp: number
}) {
  const boxesRef = useRef<THREE.Mesh[]>([])
  const colors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0x8b5cf6]

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime()
    boxesRef.current.forEach((box, i) => {
      if (state.running) {
        box.position.x += delta * boxSpeed * state.speed
        if (box.position.x > 15) {
          box.position.x = -15
        }
      }
      const mat = box.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity =
        Math.sin(elapsed * boxEmissiveFreq + i) * boxEmissiveAmp + boxEmissiveAmp
    })
  })

  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) boxesRef.current[i] = el
          }}
          position={[-14 + i * 3.5, 1.75, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, 0.8, 1]} />
          <meshStandardMaterial
            color={colors[i % colors.length]}
            roughness={0.4}
            metalness={0.3}
            emissive={colors[i % colors.length]}
            emissiveIntensity={0}
          />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------------------
// 4. 货架系统组件
// ------------------------------------------------------------
function Rack({ position }: { position: [number, number, number] }) {
  const shelfColors = useMemo(() => {
    const result: number[] = []
    for (let level = 0; level < 3; level++) {
      for (let ix = -1; ix <= 1; ix++) {
        const hue = (ix + level + 2) * 0.1
        const color = new THREE.Color().setHSL(hue, 0.6, 0.5).getHex()
        result.push(color)
      }
    }
    return result
  }, [])

  let colorIdx = 0

  return (
    <group position={position}>
      {/* 3 层货架 */}
      {[0, 1, 2].map((level) => (
        <group key={level}>
          {/* 层板 */}
          <mesh position={[0, 1.2 + level * 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[5, 0.2, 2]} />
            <meshStandardMaterial color={0x4b5563} roughness={0.6} metalness={0.7} />
          </mesh>
          {/* 层板上的货物 */}
          {[-1, 0, 1].map((ix) => (
            <mesh
              key={ix}
              position={[ix * 1.5, 2 + level * 2, 0]}
              castShadow
            >
              <boxGeometry args={[1.2, 1.4, 1.2]} />
              <meshStandardMaterial
                color={shelfColors[colorIdx++]}
                roughness={0.5}
                metalness={0.2}
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* 4 根立柱 */}
      {[
        [-2.4, -0.9],
        [2.4, -0.9],
        [-2.4, 0.9],
        [2.4, 0.9],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 3, pz]} castShadow>
          <boxGeometry args={[0.15, 6, 0.15]} />
          <meshStandardMaterial color={0x6b7280} roughness={0.5} metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------------------
// 5. 3D 场景主体（Canvas 内的部分）
// ------------------------------------------------------------
function Scene({
  machineState,
  tweakParams,
  sceneParams,
}: {
  machineState: MachineState
  tweakParams: {
    ringSpeed: number
    ringPulseFreq: number
    ringPulseAmp: number
    ringRingBaseEmissive: number
    ringStopDim: number
    errorBlinkFreq: number
    errorBlinkOpacity: number
    errorBlightLight: number
    warnBlinkFreq: number
    warnBlinkOpacity: number
    warnBlightLight: number
    normalGlowOpacity: number
    vibFreq: number
    vibAmp: number
    rollerSpeed: number
    boxSpeed: number
    boxEmissiveFreq: number
    boxEmissiveAmp: number
  }
  sceneParams: {
    showGrid: boolean
    showShadows: boolean
    mainLightIntensity: number
    ambientIntensity: number
    fillLightIntensity: number
    fogEnabled: boolean
    fogNear: number
    fogFar: number
  }
}) {
  const machineColors = [0x2563eb, 0x059669, 0xd97706, 0x7c3aed]
  const machinePositions: [number, number, number][] = [
    [-10, 0, -6],
    [-10, 0, 6],
    [10, 0, -6],
    [10, 0, 6],
  ]

  return (
    <>
      {/* drei 环境光照，PBR 效果更自然 */}
      <Environment preset="warehouse" />

      {/* 光照系统：三点布光 */}
      <ambientLight intensity={sceneParams.ambientIntensity} color={0x404060} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={sceneParams.mainLightIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
      />
      <directionalLight
        position={[-15, 10, -10]}
        intensity={sceneParams.fillLightIntensity}
        color={0x4488ff}
      />

      {/* 地面地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color={0x111827} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* drei 网格地面（带渐隐效果） */}
      {sceneParams.showGrid && (
        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={0x1a2a3a}
          sectionSize={5}
          sectionThickness={1}
          sectionColor={0x00ffff}
          fadeDistance={80}
          fadeStrength={1}
          position={[0, 0.01, 0]}
        />
      )}

      {/* 4 台加工设备 */}
      {machinePositions.map((pos, i) => (
        <Machine
          key={i}
          position={pos}
          color={machineColors[i]}
          index={i}
          state={machineState}
          tweak={tweakParams}
        />
      ))}

      {/* 传送带 */}
      <Conveyor state={machineState} rollerSpeed={tweakParams.rollerSpeed} />

      {/* 传送带上的货物 */}
      <ConveyorBoxes
        state={machineState}
        boxSpeed={tweakParams.boxSpeed}
        boxEmissiveFreq={tweakParams.boxEmissiveFreq}
        boxEmissiveAmp={tweakParams.boxEmissiveAmp}
      />

      {/* 两侧货架 */}
      <Rack position={[-22, 0, 0]} />
      <Rack position={[22, 0, 0]} />

      {/* 接触阴影：让物体落地感更强 */}
      {sceneParams.showShadows && (
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.55}
          scale={60}
          blur={2}
          far={10}
        />
      )}

      {/* drei 轨道控制器（自动每帧 update + 卸载 dispose） */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 3, 0]}
      />
    </>
  )
}

// ============================================================
// 6. 页面主组件：Canvas 容器 + 业务状态 + 控制面板
// ============================================================
const DigitalTwinR3F = () => {
  // 业务状态：与原生版完全一致
  const [machineState, setMachineState] = useState<MachineState>({
    running: true,
    speed: 0.6,
    temperature: 65,
    pressure: 2.4,
    rpm: 1800,
    efficiency: 92,
    status: 'normal',
    power: 45,
    output: 1280,
  })

  const [logs, setLogs] = useState<
    Array<{ time: string; message: string; type: 'info' | 'warn' | 'error' }>
  >([])

  const [bgColor, setBgColor] = useState('#0d1117')

  const addLog = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [{ time, message, type }, ...prev].slice(0, 8))
  }, [])

  // GUI 调试参数（Ref 保存 + useState 强制刷新，和 R3F Demo 同模式）
  const tweakParamsRef = useRef({
    ringSpeed: 0.06,
    ringPulseFreq: 3,
    ringPulseAmp: 0.4,
    ringRingBaseEmissive: 0.5,
    ringStopDim: 0.1,
    errorBlinkFreq: 8,
    errorBlinkOpacity: 0.8,
    errorBlightLight: 3,
    warnBlinkFreq: 4,
    warnBlinkOpacity: 0.4,
    warnBlightLight: 1.5,
    normalGlowOpacity: 0.05,
    vibFreq: 8,
    vibAmp: 0.02,
    rollerSpeed: 0.08,
    boxSpeed: 4,
    boxEmissiveFreq: 2,
    boxEmissiveAmp: 0.05,
  })

  const sceneParamsRef = useRef({
    showGrid: true,
    showShadows: true,
    mainLightIntensity: 0.8,
    ambientIntensity: 0.6,
    fillLightIntensity: 0.3,
    fogEnabled: true,
    fogNear: 30,
    fogFar: 80,
  })

  // ---------- 数据模拟阈值 ----------
  const warnThresh = useRef({ temp: 90, pressure: 4, efficiency: 70 })
  const errThresh = useRef({ temp: 105, pressure: 4.7, efficiency: 60 })
  const forceStatus = useRef({ status: 'auto' as 'auto' | 'normal' | 'warning' | 'error' })

  // ============================================================
  // 数据模拟 + lil-gui 初始化
  // ============================================================
  useEffect(() => {
    // 每秒更新传感器数据
    const dataInterval = setInterval(() => {
      setMachineState((prev) => {
        const baseTemp = prev.running ? 55 + prev.speed * 25 : 25
        const basePressure = prev.running ? 1.8 + prev.speed * 1.5 : 0.5
        const baseRpm = prev.running ? 600 + prev.speed * 2400 : 0
        const basePower = prev.running ? 20 + prev.speed * 60 : 2
        const baseOutput = prev.running ? 400 + prev.speed * 1600 : 0

        const nextTemp = Math.max(20, Math.min(120, baseTemp + (Math.random() - 0.5) * 8))
        const nextPressure = Math.max(0.3, Math.min(5, basePressure + (Math.random() - 0.5) * 0.4))
        const nextRpm = Math.max(0, Math.min(3600, baseRpm + (Math.random() - 0.5) * 100))
        const nextPower = Math.max(0, Math.min(100, basePower + (Math.random() - 0.5) * 8))
        const nextOutput = Math.max(0, baseOutput + (Math.random() - 0.5) * 150)

        let nextEfficiency = prev.efficiency + (Math.random() - 0.5) * 1.5
        if (nextTemp > 95) nextEfficiency -= 3
        nextEfficiency = Math.max(50, Math.min(99, nextEfficiency))

        let nextStatus: 'normal' | 'warning' | 'error' = 'normal'
        if (
          nextTemp > warnThresh.current.temp ||
          nextPressure > warnThresh.current.pressure ||
          nextEfficiency < warnThresh.current.efficiency
        )
          nextStatus = 'warning'
        if (
          nextTemp > errThresh.current.temp ||
          nextPressure > errThresh.current.pressure ||
          nextEfficiency < errThresh.current.efficiency
        )
          nextStatus = 'error'

        if (forceStatus.current.status !== 'auto') {
          nextStatus = forceStatus.current.status as any
        }

        if (prev.status !== nextStatus) {
          const statusMap = { normal: '正常运行', warning: '注意警告', error: '故障告警' }
          const logType = nextStatus === 'error' ? 'error' : nextStatus === 'warning' ? 'warn' : 'info'
          setTimeout(() => addLog(`设备状态变更: ${statusMap[nextStatus]}`, logType), 0)
        }

        return {
          ...prev,
          temperature: nextTemp,
          pressure: nextPressure,
          rpm: nextRpm,
          efficiency: nextEfficiency,
          status: nextStatus,
          power: nextPower,
          output: nextOutput,
        }
      })
    }, 1000)

    // lil-gui 面板（和 R3F Demo 一样挂载到 body）
    const gui = new GUI({ title: '🛠️ R3F 数字孪生调试面板', width: 300 })
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '16px'
    gui.domElement.style.right = '412px'
    gui.domElement.style.zIndex = '9999'
    document.body.appendChild(gui.domElement)

    const fRing = gui.addFolder('🔵 旋转环')
    fRing.add(tweakParamsRef.current, 'ringSpeed', 0, 0.5, 0.001).name('转速倍率')
    fRing.add(tweakParamsRef.current, 'ringPulseFreq', 0.1, 10, 0.1).name('脉动频率')
    fRing.add(tweakParamsRef.current, 'ringPulseAmp', 0, 1, 0.01).name('脉动幅度')
    fRing.add(tweakParamsRef.current, 'ringRingBaseEmissive', 0, 2, 0.01).name('基底发光')
    fRing.add(tweakParamsRef.current, 'ringStopDim', 0, 1, 0.01).name('停止衰减')

    const fWarn = gui.addFolder('🚨 警示灯')
    fWarn.add(tweakParamsRef.current, 'errorBlinkFreq', 0.5, 20, 0.1).name('故障闪烁频率')
    fWarn.add(tweakParamsRef.current, 'errorBlinkOpacity', 0, 1, 0.01).name('故障闪烁亮度')
    fWarn.add(tweakParamsRef.current, 'errorBlightLight', 0, 10, 0.1).name('故障灯光强度')
    fWarn.add(tweakParamsRef.current, 'warnBlinkFreq', 0.5, 15, 0.1).name('警告闪烁频率')
    fWarn.add(tweakParamsRef.current, 'warnBlinkOpacity', 0, 1, 0.01).name('警告闪烁亮度')
    fWarn.add(tweakParamsRef.current, 'warnBlightLight', 0, 10, 0.1).name('警告灯光强度')
    fWarn.add(tweakParamsRef.current, 'normalGlowOpacity', 0, 0.3, 0.001).name('正常微弱发光')

    const fVib = gui.addFolder('📳 设备振动')
    fVib.add(tweakParamsRef.current, 'vibFreq', 0, 30, 0.1).name('振动频率')
    fVib.add(tweakParamsRef.current, 'vibAmp', 0, 0.5, 0.001).name('振动幅度')

    const fConv = gui.addFolder('📦 传送带 & 货物')
    fConv.add(tweakParamsRef.current, 'rollerSpeed', 0, 0.5, 0.001).name('滚筒转速')
    fConv.add(tweakParamsRef.current, 'boxSpeed', 0, 20, 0.1).name('货物移动速度')
    fConv.add(tweakParamsRef.current, 'boxEmissiveFreq', 0, 10, 0.1).name('箱子发光频率')
    fConv.add(tweakParamsRef.current, 'boxEmissiveAmp', 0, 0.5, 0.01).name('箱子发光幅度')

    const fScene = gui.addFolder('💡 场景 & 光照')
    fScene.add(sceneParamsRef.current, 'showGrid').name('显示网格')
    fScene.add(sceneParamsRef.current, 'showShadows').name('接触阴影')
    fScene.add(sceneParamsRef.current, 'mainLightIntensity', 0, 3, 0.01).name('主光强度')
    fScene.add(sceneParamsRef.current, 'ambientIntensity', 0, 2, 0.01).name('环境光强度')
    fScene.add(sceneParamsRef.current, 'fillLightIntensity', 0, 2, 0.01).name('补光强度')
    fScene.add(sceneParamsRef.current, 'fogEnabled').name('雾效开关')
    fScene.add(sceneParamsRef.current, 'fogNear', 0, 100, 0.5).name('雾近距')
    fScene.add(sceneParamsRef.current, 'fogFar', 0, 200, 0.5).name('雾远距')
    fScene
      .addColor({ bgColor: '#0d1117' }, 'bgColor')
      .name('背景色')
      .onChange((v: string) => {
        setBgColor(v)
      })

    const fData = gui.addFolder('📊 数据模拟阈值')
    fData.add(warnThresh.current, 'temp', 40, 120, 1).name('警告温度阈值')
    fData.add(warnThresh.current, 'pressure', 1, 5, 0.1).name('警告压力阈值')
    fData.add(warnThresh.current, 'efficiency', 40, 90, 1).name('警告效率阈值')
    fData.add(errThresh.current, 'temp', 50, 150, 1).name('故障温度阈值')
    fData.add(errThresh.current, 'pressure', 2, 6, 0.1).name('故障压力阈值')
    fData.add(errThresh.current, 'efficiency', 30, 80, 1).name('故障效率阈值')

    const fDebug = gui.addFolder('🎚️ 手动调试')
    fDebug
      .add(forceStatus.current, 'status', ['auto', 'normal', 'warning', 'error'])
      .name('强制状态')
      .onChange((v: string) => {
        if (v === 'auto') return
        setMachineState((prev) => ({ ...prev, status: v as any }))
      })
    fDebug
      .add(
        {
          override: () => {
            setMachineState((prev) => ({ ...prev, temperature: 110 }))
          },
        },
        'override',
      )
      .name('🔥 强制过热 110°C')
    fDebug
      .add(
        {
          override: () => {
            setMachineState((prev) => ({
              ...prev,
              temperature: 50,
              pressure: 2,
              efficiency: 95,
              status: 'normal',
            }))
            forceStatus.current.status = 'auto'
          },
        },
        'override',
      )
      .name('✅ 恢复正常')

    // 每 5 秒产生一条运行日志
    let lastLogTime = 0
    const logInterval = setInterval(() => {
      const now = Date.now() / 1000
      if (machineState.running && now - lastLogTime > 5) {
        lastLogTime = now
        const events = [
          `已生产 ${Math.floor(machineState.output).toLocaleString()} 件产品`,
          `能耗 ${machineState.power.toFixed(1)} kW · 效率 ${machineState.efficiency.toFixed(1)}%`,
          `传送带速度 ${(machineState.speed * 100).toFixed(0)}% - 运行正常`,
        ]
        addLog(events[Math.floor(Math.random() * events.length)], 'info')
      }
    }, 1000)

    addLog('数字孪生系统 (R3F版) 启动成功', 'info')
    addLog('设备初始化完成，进入运行状态', 'info')

    return () => {
      clearInterval(dataInterval)
      clearInterval(logInterval)
      gui.destroy()
      if (gui.domElement.parentNode) gui.domElement.parentNode.removeChild(gui.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog])

  // 每 500ms 强制刷新一次，让 GUI 中无 onChange 的参数也能生效
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      forceTick((t) => (t + 1) % 1000000)
    }, 500)
    return () => clearInterval(id)
  }, [])

  // ----------------------------------------------------------
  // 交互逻辑
  // ----------------------------------------------------------
  const toggleRunning = () => {
    setMachineState((prev) => {
      const nextRunning = !prev.running
      addLog(nextRunning ? '设备已启动' : '设备已停止', nextRunning ? 'info' : 'warn')
      return { ...prev, running: nextRunning }
    })
  }

  const setSpeed = (val: number) => {
    setMachineState((prev) => {
      addLog(`运行速度调整至 ${(val * 100).toFixed(0)}%`, 'info')
      return { ...prev, speed: val }
    })
  }

  const resetSystem = () => {
    setMachineState({
      running: true,
      speed: 0.6,
      temperature: 65,
      pressure: 2.4,
      rpm: 1800,
      efficiency: 92,
      status: 'normal',
      power: 45,
      output: 1280,
    })
    forceStatus.current.status = 'auto'
    setLogs([])
    addLog('系统已重置', 'info')
  }

  const statusColors = {
    normal: { bg: '#065f46', text: '#34d399', border: '#10b981', label: '正常' },
    warning: { bg: '#78350f', text: '#fbbf24', border: '#f59e0b', label: '警告' },
    error: { bg: '#7f1d1d', text: '#f87171', border: '#ef4444', label: '故障' },
  }

  // ----------------------------------------------------------
  // 数据卡片子组件
  // ----------------------------------------------------------
  const DataCard = ({
    label,
    value,
    unit,
    color,
    icon,
    min,
    max,
  }: {
    label: string
    value: number
    unit: string
    color: string
    icon: string
    min?: number
    max?: number
  }) => {
    const percent =
      min !== undefined && max !== undefined
        ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
        : 0
    return (
      <div style={styles.dataCard}>
        <div style={styles.dataCardTop}>
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span style={styles.dataCardLabel}>{label}</span>
        </div>
        <div style={styles.dataCardValueRow}>
          <span style={{ ...styles.dataCardValue, color }}>
            {value.toFixed(value < 10 ? 1 : 0)}
          </span>
          <span style={styles.dataCardUnit}>{unit}</span>
        </div>
        {min !== undefined && max !== undefined && (
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${color}44, ${color})`,
                boxShadow: `0 0 8px ${color}80`,
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // ----------------------------------------------------------
  // JSX 渲染
  // ----------------------------------------------------------
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🏭</span>
          <div>
            <h1 style={styles.headerTitle}>数字孪生系统 · R3F 版</h1>
            <p style={styles.headerSubtitle}>智能工厂实时监控 · React Three Fiber 声明式架构</p>
          </div>
        </div>
        <div
          style={{
            ...styles.statusBadge,
            background: statusColors[machineState.status].bg,
            borderColor: statusColors[machineState.status].border,
          }}
        >
          <span
            style={{
              ...styles.statusDot,
              background: statusColors[machineState.status].text,
              boxShadow: `0 0 10px ${statusColors[machineState.status].text}`,
            }}
          />
          <span style={{ ...styles.statusText, color: statusColors[machineState.status].text }}>
            {statusColors[machineState.status].label} · {machineState.running ? '运行中' : '已停止'}
          </span>
        </div>
      </div>

      <div style={styles.main}>
        {/* 左侧：R3F Canvas 画布 */}
        <div style={{ ...styles.canvasWrap, background: bgColor }}>
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [18, 14, 22], fov: 50, near: 0.1, far: 500 }}
            gl={{ antialias: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.05
            }}
          >
            {/* 背景色 + 雾效：响应式绑定 React state */}
            <color attach="background" args={[bgColor]} />
            {sceneParamsRef.current.fogEnabled && (
              <fog
                attach="fog"
                args={[bgColor, sceneParamsRef.current.fogNear, sceneParamsRef.current.fogFar]}
              />
            )}

            <Stats />

            <Scene
              machineState={machineState}
              tweakParams={tweakParamsRef.current}
              sceneParams={sceneParamsRef.current}
            />
          </Canvas>

          <div style={styles.canvasOverlay}>
            <div style={styles.overlayTip}>
              ⚛️ R3F 声明式渲染 · 🖱️ 拖拽旋转 · 滚轮缩放
            </div>
          </div>
        </div>

        {/* 右侧侧栏：控制面板 + 数据卡片 + 日志 */}
        <aside style={styles.sidebar}>
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>🎛️ 设备控制</h3>
            <div style={styles.controlRow}>
              <button
                style={{
                  ...styles.ctrlBtn,
                  background: machineState.running
                    ? 'linear-gradient(135deg,#065f46,#10b981)'
                    : 'linear-gradient(135deg,#7f1d1d,#ef4444)',
                  boxShadow: machineState.running
                    ? '0 4px 20px #10b98166'
                    : '0 4px 20px #ef444466',
                }}
                onClick={toggleRunning}
              >
                {machineState.running ? '⏸ 停止运行' : '▶ 启动运行'}
              </button>
              <button style={{ ...styles.ctrlBtn, ...styles.ctrlBtnSec }} onClick={resetSystem}>
                ↺ 重置
              </button>
            </div>

            <div style={styles.sliderRow}>
              <div style={styles.sliderLabel}>
                <span>运行速度</span>
                <span style={{ color: '#38bdf8' }}>{(machineState.speed * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={machineState.speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={styles.slider}
              />
            </div>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>📊 实时数据</h3>
            <div style={styles.dataGrid}>
              <DataCard
                label="温度"
                value={machineState.temperature}
                unit="°C"
                color="#f87171"
                icon="🌡️"
                min={0}
                max={120}
              />
              <DataCard
                label="压力"
                value={machineState.pressure}
                unit="MPa"
                color="#fb923c"
                icon="💨"
                min={0}
                max={5}
              />
              <DataCard
                label="转速"
                value={machineState.rpm}
                unit="RPM"
                color="#34d399"
                icon="⚙️"
                min={0}
                max={3600}
              />
              <DataCard
                label="效率"
                value={machineState.efficiency}
                unit="%"
                color="#60a5fa"
                icon="📈"
                min={0}
                max={100}
              />
              <DataCard
                label="功率"
                value={machineState.power}
                unit="kW"
                color="#a78bfa"
                icon="⚡"
                min={0}
                max={100}
              />
              <DataCard
                label="产量"
                value={machineState.output}
                unit="件/h"
                color="#f472b6"
                icon="📦"
                min={0}
                max={3000}
              />
            </div>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>📋 系统日志</h3>
            <div style={styles.logList}>
              {logs.length === 0 ? (
                <div style={styles.logEmpty}>暂无日志...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={styles.logItem}>
                    <span style={styles.logTime}>{log.time}</span>
                    <span
                      style={{
                        ...styles.logDot,
                        background:
                          log.type === 'error'
                            ? '#ef4444'
                            : log.type === 'warn'
                            ? '#f59e0b'
                            : '#3b82f6',
                      }}
                    />
                    <span style={styles.logMsg}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={{ ...styles.panel, ...styles.aboutPanel }}>
            <h4 style={styles.aboutTitle}>💡 关于 R3F 版数字孪生</h4>
            <p style={styles.aboutText}>
              本页面使用 React Three Fiber 声明式架构重写数字孪生系统。对比原生 Three.js 版：
              无需手动管理场景生命周期（scene.add/dispose/resize）、通过 JSX 组合 3D
              组件、useFrame 钩子统一驱动帧动画、drei 生态组件大幅简化网格/控制器/阴影。
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

// ============================================================
// 内联样式（直接复用 DigitalTwin.tsx 的样式表，保持视觉一致）
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: '#010409',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    background: 'linear-gradient(90deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
    borderBottom: '1px solid #21262d',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    fontSize: '32px',
    filter: 'drop-shadow(0 0 10px #3b82f6)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0f6fc',
    letterSpacing: '0.5px',
  },
  headerSubtitle: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#8b949e',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 18px',
    borderRadius: 100,
    border: '1px solid',
    backdropFilter: 'blur(10px)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  statusText: {
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  main: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  canvasWrap: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
    transition: 'background 0.4s ease',
  },
  canvasOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    pointerEvents: 'none',
  },
  overlayTip: {
    padding: '6px 14px',
    background: 'rgba(22,27,34,0.8)',
    backdropFilter: 'blur(8px)',
    border: '1px solid #30363d',
    borderRadius: 8,
    fontSize: '12px',
    color: '#8b949e',
  },
  sidebar: {
    width: 380,
    minWidth: 380,
    background: '#0d1117',
    borderLeft: '1px solid #21262d',
    overflowY: 'auto',
    padding: '18px 16px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  panel: {
    background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
    borderRadius: 14,
    padding: '16px 18px',
    border: '1px solid #21262d',
  },
  panelTitle: {
    margin: '0 0 14px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0f6fc',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  controlRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
  },
  ctrlBtn: {
    flex: 1,
    padding: '11px 12px',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.5px',
  },
  ctrlBtnSec: {
    flex: 'none',
    width: 80,
    background: 'linear-gradient(135deg,#1f2937,#374151)',
    border: '1px solid #4b5563',
    color: '#d1d5db',
  },
  sliderRow: {
    marginTop: 6,
  },
  sliderLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: '13px',
    color: '#c9d1d9',
  },
  slider: {
    width: '100%',
    height: 6,
    appearance: 'none',
    background: '#21262d',
    borderRadius: 3,
    outline: 'none',
    cursor: 'pointer',
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  dataCard: {
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: '12px 12px 10px',
    border: '1px solid #21262d',
  },
  dataCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dataCardLabel: {
    fontSize: '11px',
    color: '#8b949e',
  },
  dataCardValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  dataCardValue: {
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  dataCardUnit: {
    fontSize: '11px',
    color: '#6e7681',
  },
  progressBar: {
    height: 4,
    background: '#21262d',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 200,
    overflowY: 'auto',
  },
  logEmpty: {
    textAlign: 'center',
    padding: '20px 0',
    fontSize: '12px',
    color: '#484f58',
  },
  logItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    border: '1px solid #161b22',
  },
  logTime: {
    fontSize: '11px',
    color: '#484f58',
    fontFamily: 'ui-monospace, monospace',
    flexShrink: 0,
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  logMsg: {
    fontSize: '12px',
    color: '#c9d1d9',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  aboutPanel: {
    marginTop: 'auto',
    background: 'linear-gradient(180deg, rgba(79,70,229,0.08), rgba(124,58,237,0.08))',
    border: '1px solid rgba(99,102,241,0.2)',
  },
  aboutTitle: {
    margin: '0 0 8px',
    fontSize: '13px',
    color: '#a5b4fc',
  },
  aboutText: {
    margin: 0,
    fontSize: '12px',
    color: '#8b949e',
    lineHeight: 1.7,
  },
}

export default DigitalTwinR3F
