// ============================================================
// 数字孪生 Demo - 智能工厂实时监控与数字映射平台
// 核心架构：React 状态管理 + Three.js 3D 可视化
// 数据流：用户操作 / 数据模拟 → React State → stateRef → 动画循环 → 3D 场景
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

// ------------------------------------------------------------
// 设备状态接口 - 定义"数字孪生"的核心数据模型
// 这是物理设备在虚拟世界的映射，真实场景下这些数据来自传感器
// ------------------------------------------------------------
interface MachineState {
  running: boolean      // 设备是否运行（影响所有动画）
  speed: number         // 运行速度倍率 0.1~1，决定动画快慢和数据基线
  temperature: number   // 温度 °C - 传感器指标 1
  pressure: number      // 压力 MPa - 传感器指标 2
  rpm: number           // 转速 RPM - 设备运行参数
  efficiency: number    // 效率 % - 设备健康度
  status: 'normal' | 'warning' | 'error'  // 运行状态等级
  power: number         // 功率 kW - 能源消耗
  output: number        // 产量 件/h - 生产效率
}

const DigitalTwin = () => {
  // ----------------------------------------------------------
  // useRef：保存 Three.js 核心对象引用
  // 为什么用 ref 不用 state？因为 Three.js 对象不参与 React 渲染，
  // 放 state 会触发不必要的重渲染，也无法在动画循环里稳定读取。
  // ----------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null)          // 3D 画布挂载的 DOM 容器
  const sceneRef = useRef<THREE.Scene | null>(null)          // Three.js 场景根节点
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)  // WebGL 渲染器
  const frameIdRef = useRef<number>(0)                       // requestAnimationFrame 的 ID，用于卸载时取消
  const machinesRef = useRef<THREE.Group[]>([])              // 4 台设备的 Group 引用数组
  const conveyorRef = useRef<THREE.Mesh | null>(null)        // 传送带（当前主要用于引用保留）
  const warningLightsRef = useRef<THREE.PointLight[]>([])    // 所有警示灯的 PointLight 引用

  // ----------------------------------------------------------
  // useState：保存业务状态（参与 React UI 渲染）
  // 这些值会显示在右侧面板的数据卡片上
  // ----------------------------------------------------------
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

  // 系统日志列表：最多保留 8 条，按时间倒序
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'warn' | 'error' }>>([])

  // ----------------------------------------------------------
  // addLog：添加日志记录（useCallback 是为了把函数作为 useEffect 依赖且不变）
  // ----------------------------------------------------------
  const addLog = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    // 新日志插入数组头部，截取最多 8 条
    setLogs((prev) => [{ time, message, type }, ...prev].slice(0, 8))
  }, [])

  // ============================================================
  // useEffect：Three.js 场景初始化 & 动画循环 & 数据模拟
  // 依赖 [addLog] 保证整个场景只在组件挂载时构建一次
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return

    // 获取画布尺寸，按容器 1:1 渲染
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // ----------------------------------------------------------
    // 1. 初始化场景、相机、渲染器
    // ----------------------------------------------------------
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d1117)          // 深色背景（GitHub Night 风格）
    scene.fog = new THREE.Fog(0x0d1117, 30, 80)          // 线性雾：30 开始渐隐，80 全黑
    sceneRef.current = scene


    // 透视相机：fov=50°，近裁面 0.1，远裁面 500
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)
    // 相机放在工厂的右上方俯视，能同时看到设备和传送带
    camera.position.set(18, 14, 22)

    // WebGL 渲染器：开启抗锯齿、软阴影、像素比上限（防止 4K 屏性能下降）
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true                     // 开启阴影
    renderer.shadowMap.type = THREE.PCFSoftShadowMap      // PCF 软阴影（边缘柔和）
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ----------------------------------------------------------
    // 2. 初始化 OrbitControls 视角控制
    // 负责"鼠标拖拽旋转 / 滚轮缩放 / 右键平移"
    // ----------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true          // 开启阻尼（松手后缓慢停止，体验更自然）
    controls.dampingFactor = 0.08          // 阻尼系数，越小越"滑"
    controls.minDistance = 8               // 最近缩放距离（防止穿模）
    controls.maxDistance = 60              // 最远缩放距离
    controls.maxPolarAngle = Math.PI / 2.1 // 俯仰角限制：不能转到地面以下
    controls.target.set(0, 3, 0)           // 观察点设在传送带高度附近

    // ----------------------------------------------------------
    // 3. 光照系统（三点布光 + 环境光）
    // ----------------------------------------------------------
    // 环境光：整体基底亮度，避免阴影面完全死黑；偏蓝紫色增加科技感
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6)
    scene.add(ambientLight)

    // 主方向光：模拟太阳光，主要投射阴影来源
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(20, 30, 15)     // 从右上斜向照射
    mainLight.castShadow = true            // 启用投影
    mainLight.shadow.mapSize.set(2048, 2048)  // 阴影贴图分辨率，越大越清晰越慢
    // 阴影相机范围：必须覆盖整个工厂区域，否则投影缺失
    mainLight.shadow.camera.left = -30
    mainLight.shadow.camera.right = 30
    mainLight.shadow.camera.top = 30
    mainLight.shadow.camera.bottom = -30
    mainLight.shadow.camera.near = 0.5
    mainLight.shadow.camera.far = 100
    scene.add(mainLight)

    // 蓝色补光：从背面/侧方打光，让深色物体轮廓可见，冷暖对比更有层次
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3)
    fillLight.position.set(-15, 10, -10)
    scene.add(fillLight)

    // ----------------------------------------------------------
    // 4. 地面与网格
    // ----------------------------------------------------------
    // 青色网格辅助线：工厂地面坐标参考
    const gridHelper = new THREE.GridHelper(50, 50, 0x00ffff, 0x1a2a3a)
    ;(gridHelper.material as THREE.Material).opacity = 0.4
    ;(gridHelper.material as THREE.Material).transparent = true
    scene.add(gridHelper)

    // 平面地板：接收阴影（receiveShadow），不投射（castShadow 默认 false）
    const floorGeo = new THREE.PlaneGeometry(50, 50)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,   // 粗糙度 0.8：水泥地面质感
      metalness: 0.2,   // 金属度 0.2：略反光但不是金属
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2  // Plane 默认在 XY 平面，绕 X 轴旋转 90° 变成 XZ 地面
    floor.receiveShadow = true
    scene.add(floor)

    // ============================================================
    // 5. 创建设备模型（工厂里的 4 台加工设备）
    // 每台设备是一个 THREE.Group（多个 Mesh 的组合容器）
    // ============================================================
    const createMachine = (x: number, z: number, color: number, index: number): THREE.Group => {
      const group = new THREE.Group()
      group.position.set(x, 0, z)   // 设备在地面上的 X/Z 位置

      // ---------- 底座：深灰色金属立方 ----------
      const baseGeo = new THREE.BoxGeometry(4, 1, 4)
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.5,
        metalness: 0.8,
      })
      const base = new THREE.Mesh(baseGeo, baseMat)
      base.position.y = 0.5         // 立方高度 1，中心抬 0.5 使底面贴地
      base.castShadow = true
      base.receiveShadow = true
      group.add(base)

      // ---------- 机身：带色金属立方（4 台颜色不同便于区分） ----------
      const bodyGeo = new THREE.BoxGeometry(3.2, 2.5, 3.2)
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.7,
      })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 2.25        // 底座高 1 + 自身 2.5/2 = 2.25
      body.castShadow = true
      group.add(body)

      // ---------- 控制面板：黑色带自发光的"屏幕" ----------
      // emissive = 自发光色，即便没光打到它也会亮
      const panelGeo = new THREE.BoxGeometry(2.8, 1.5, 0.1)
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        emissive: 0x001133,          // 深蓝色屏幕发光
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.9,
      })
      const panel = new THREE.Mesh(panelGeo, panelMat)
      panel.position.set(0, 2.5, 1.61)  // 贴在机身正面（Z 最大的面）
      group.add(panel)

      // ---------- 旋转环：青色发光圆环，作为"设备运行"的可视化指示 ----------
      // 关键：通过 userData 打标签，动画循环遍历到 isRing=true 就旋转它
      const ringGeo = new THREE.TorusGeometry(0.8, 0.15, 16, 48)
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.9,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(0, 3.8, 1.65)
      ring.rotation.x = Math.PI / 2     // 默认圆环躺在 XY 平面，翻转成面对前方
      group.add(ring)
      ;(ring as any).userData.isRing = true   // ← 打标签：我是旋转环
      ;(ring as any).userData.index = index   // 设备编号，用于相位错开

      // ---------- 3 个按钮：绿 / 黄 / 红 ----------
      for (let i = 0; i < 3; i++) {
        const btnGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16)
        const btnColor = i === 0 ? 0x00ff88 : i === 1 ? 0xffaa00 : 0xff4444
        const btnMat = new THREE.MeshStandardMaterial({
          color: btnColor,
          emissive: btnColor,
          emissiveIntensity: 0.6,         // 都带一点发光，像真实的按钮指示灯
        })
        const btn = new THREE.Mesh(btnGeo, btnMat)
        btn.rotation.x = Math.PI / 2      // 圆柱默认竖直躺，翻成正面凸出来
        btn.position.set(-0.8 + i * 0.8, 1.8, 1.66)
        group.add(btn)
      }

      // ---------- 两侧管道：灰色金属圆柱 ----------
      const pipeGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 16)
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.4,
        metalness: 0.9,
      })
      // 左侧管道
      const pipe1 = new THREE.Mesh(pipeGeo, pipeMat)
      pipe1.position.set(-1.8, 3, 0)
      pipe1.rotation.z = Math.PI / 2     // 转成横向
      pipe1.castShadow = true
      group.add(pipe1)
      // 右侧管道（复用同一几何体和材质，节省显存）
      const pipe2 = new THREE.Mesh(pipeGeo, pipeMat)
      pipe2.position.set(1.8, 3, 0)
      pipe2.rotation.z = Math.PI / 2
      pipe2.castShadow = true
      group.add(pipe2)

      // ---------- 顶部警示灯：PointLight（真正照出光晕） + 发光球（可视化灯体） ----------
      const warningLight = new THREE.PointLight(0xff4400, 0, 10)  // 初始强度 0 = 不亮
      warningLight.position.set(0, 4.5, 0)
      group.add(warningLight)
      warningLightsRef.current.push(warningLight)

      // 发光球壳：MeshBasicMaterial 不参与光照，本身就是纯色
      const glowGeo = new THREE.SphereGeometry(0.3, 16, 16)
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0,           // 初始不可见，状态变为 warning/error 再显现
      })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.position.set(0, 4.5, 0)
      group.add(glow)
      ;(glow as any).userData.isGlow = true                // ← 打标签：我是警示灯体
      ;(glow as any).userData.light = warningLight         // 方便直接拿到对应的 PointLight 引用

      scene.add(group)
      return group
    }

    // 4 台设备的颜色和位置（传送带左上/左下/右上/右下 4 个角）
    const machineColors = [0x2563eb, 0x059669, 0xd97706, 0x7c3aed]
    const machinePositions = [
      [-10, -6],
      [-10, 6],
      [10, -6],
      [10, 6],
    ]
    machinePositions.forEach((pos, i) => {
      machinesRef.current.push(createMachine(pos[0], pos[1], machineColors[i], i))
    })

    // ============================================================
    // 6. 创建传送带系统（横跨整个工厂中央）
    // ============================================================
    const conveyorGroup = new THREE.Group()

    // ---------- 皮带表面：深黑色磨砂 ----------
    const convBeltGeo = new THREE.BoxGeometry(26, 0.3, 2)
    const convBeltMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.1,
    })
    const conveyorBelt = new THREE.Mesh(convBeltGeo, convBeltMat)
    conveyorBelt.position.y = 1.15
    conveyorBelt.receiveShadow = true
    conveyorGroup.add(conveyorBelt)
    conveyorRef.current = conveyorBelt

    // ---------- 金属框架 ----------
    const convFrameGeo = new THREE.BoxGeometry(26.4, 0.5, 2.4)
    const convFrameMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.5,
      metalness: 0.8,
    })
    const convFrame = new THREE.Mesh(convFrameGeo, convFrameMat)
    convFrame.position.y = 0.75
    convFrame.castShadow = true
    convFrame.receiveShadow = true
    conveyorGroup.add(convFrame)

    // ---------- 支腿：每隔 2 单位一根，左右各一根 ----------
    for (let i = -13; i <= 13; i += 2) {
      const legGeo = new THREE.BoxGeometry(0.3, 1, 0.3)
      const legMat = new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        roughness: 0.6,
        metalness: 0.7,
      })
      const leg1 = new THREE.Mesh(legGeo, legMat)
      leg1.position.set(i, 0.25, -1.2)
      leg1.castShadow = true
      leg1.receiveShadow = true
      conveyorGroup.add(leg1)

      const leg2 = new THREE.Mesh(legGeo, legMat)
      leg2.position.set(i, 0.25, 1.2)
      leg2.castShadow = true
      leg2.receiveShadow = true
      conveyorGroup.add(leg2)
    }

    // ---------- 滚筒：皮带下方一根根金属圆柱，带动皮带 ----------
    // 同样用 userData.isRoller 打标签，动画循环让它滚动
    for (let i = -12; i <= 12; i += 1.5) {
      const rollerGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.1, 12)
      const rollerMat = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.3,
        metalness: 0.9,
      })
      const roller = new THREE.Mesh(rollerGeo, rollerMat)
      roller.rotation.z = Math.PI / 2
      roller.position.set(i, 1, 0)
      roller.castShadow = true
      conveyorGroup.add(roller)
      ;(roller as any).userData.isRoller = true  // ← 打标签：我是滚筒
    }

    scene.add(conveyorGroup)

    // ============================================================
    // 7. 传送带上的 8 个货物箱（循环移动）
    // ============================================================
    const boxColors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0x8b5cf6]
    const boxes: THREE.Mesh[] = []
    for (let i = 0; i < 8; i++) {
      const boxGeo = new THREE.BoxGeometry(1, 0.8, 1)
      const boxMat = new THREE.MeshStandardMaterial({
        color: boxColors[i % boxColors.length],
        roughness: 0.4,
        metalness: 0.3,
      })
      const box = new THREE.Mesh(boxGeo, boxMat)
      // 初始位置：沿 X 轴均匀分布在传送带上，Y 刚好坐在皮带上方
      box.position.set(-14 + i * 3.5, 1.75, 0)
      box.castShadow = true
      box.receiveShadow = true
      scene.add(box)
      boxes.push(box)
    }

    // ============================================================
    // 8. 货架系统：两侧各 3 层货架 + 每层货物
    // ============================================================
    const createRack = (x: number, z: number): THREE.Group => {
      const group = new THREE.Group()
      group.position.set(x, 0, z)

      // 3 层货架
      for (let level = 0; level < 3; level++) {
        // 层板
        const shelfGeo = new THREE.BoxGeometry(5, 0.2, 2)
        const shelfMat = new THREE.MeshStandardMaterial({
          color: 0x4b5563,
          roughness: 0.6,
          metalness: 0.7,
        })
        const shelf = new THREE.Mesh(shelfGeo, shelfMat)
        shelf.position.y = 1.2 + level * 2  // 每层 2 个单位高度
        shelf.castShadow = true
        shelf.receiveShadow = true
        group.add(shelf)

        // 层板上的 3 个货箱（HSL 配色，颜色按层级错开）
        for (let ix = -1; ix <= 1; ix++) {
          for (let iz = 0; iz <= 0; iz++) {
            const itemGeo = new THREE.BoxGeometry(1.2, 1.4, 1.2)
            const itemMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color().setHSL((ix + level + 2) * 0.1, 0.6, 0.5),
              roughness: 0.5,
              metalness: 0.2,
            })
            const item = new THREE.Mesh(itemGeo, itemMat)
            item.position.set(ix * 1.5, 2 + level * 2, iz)
            item.castShadow = true
            group.add(item)
          }
        }
      }

      // 4 根立柱支撑货架
      const postGeo = new THREE.BoxGeometry(0.15, 6, 0.15)
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.5,
        metalness: 0.8,
      })
      const positions = [
        [-2.4, -0.9],
        [2.4, -0.9],
        [-2.4, 0.9],
        [2.4, 0.9],
      ]
      positions.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeo, postMat)
        post.position.set(px, 3, pz)  // 立柱高 6，中心抬 3
        post.castShadow = true
        group.add(post)
      })

      scene.add(group)
      return group
    }

    // 在工厂左右两侧各放一个货架
    createRack(-22, 0)
    createRack(22, 0)

    // ============================================================
    // 9. 数据模拟 + 动画循环（核心驱动部分）
    // ============================================================
    const clock = new THREE.Clock()   // 计时器，用于平滑动画

    // ---------- 关键：stateRef 作为"React State → 动画循环"的桥梁 ----------
    // animate 闭包中直接读 machineState 永远拿到初始值（因为 useEffect 只跑一次），
    // 所以每次 setMachineState 更新后，同步把新值写回 stateRef，
    // 动画循环读 stateRef 就能拿到最新状态。
    let stateRef = { ...machineState }

    // ---------- GUI 可调：状态判定阈值 & 强制覆盖 ----------
    // 提前声明，供 setInterval 内的判定逻辑使用
    const warnThresh = { temp: 90, pressure: 4, efficiency: 70 }
    const errThresh = { temp: 105, pressure: 4.7, efficiency: 60 }
    const forceStatus = { status: 'auto' as 'auto' | 'normal' | 'warning' | 'error' }

    // ---------- 数据模拟定时器：每秒更新一次传感器数据 ----------
    // 真实场景下，这里应改成 WebSocket / MQTT / SSE 订阅真实设备推送
    const dataInterval = setInterval(() => {
      setMachineState((prev) => {
        // 基线值由 running 和 speed 决定：越快越"卖力"，各项指标越高
        const baseTemp = prev.running ? 55 + prev.speed * 25 : 25
        const basePressure = prev.running ? 1.8 + prev.speed * 1.5 : 0.5
        const baseRpm = prev.running ? 600 + prev.speed * 2400 : 0
        const basePower = prev.running ? 20 + prev.speed * 60 : 2
        const baseOutput = prev.running ? 400 + prev.speed * 1600 : 0

        // 在基线基础上加随机抖动，模拟真实传感器噪声
        const nextTemp = Math.max(20, Math.min(120, baseTemp + (Math.random() - 0.5) * 8))
        const nextPressure = Math.max(0.3, Math.min(5, basePressure + (Math.random() - 0.5) * 0.4))
        const nextRpm = Math.max(0, Math.min(3600, baseRpm + (Math.random() - 0.5) * 100))
        const nextPower = Math.max(0, Math.min(100, basePower + (Math.random() - 0.5) * 8))
        const nextOutput = Math.max(0, baseOutput + (Math.random() - 0.5) * 150)

        // 效率：随机波动 + 温度过高时降低（模拟过热降效）
        let nextEfficiency = prev.efficiency + (Math.random() - 0.5) * 1.5
        if (nextTemp > 95) nextEfficiency -= 3
        nextEfficiency = Math.max(50, Math.min(99, nextEfficiency))

        // 状态判定规则：阈值来自 warnThresh / errThresh（lil-gui 可调）
        let nextStatus: 'normal' | 'warning' | 'error' = 'normal'
        if (nextTemp > warnThresh.temp || nextPressure > warnThresh.pressure || nextEfficiency < warnThresh.efficiency) nextStatus = 'warning'
        if (nextTemp > errThresh.temp || nextPressure > errThresh.pressure || nextEfficiency < errThresh.efficiency) nextStatus = 'error'

        // 手动强制状态覆盖（调试面板里设置后，会覆盖自动判定结果）
        if (forceStatus.status !== 'auto') {
          nextStatus = forceStatus.status as any
        }

        // 状态变更时写日志（setTimeout 0 是为了跳出 setMachineState 回调，避免与 React 状态冲突）
        if (prev.status !== nextStatus) {
          const statusMap = { normal: '正常运行', warning: '注意警告', error: '故障告警' }
          const logType = nextStatus === 'error' ? 'error' : nextStatus === 'warning' ? 'warn' : 'info'
          setTimeout(() => addLog(`设备状态变更: ${statusMap[nextStatus]}`, logType), 0)
        }

        // 同步写入 stateRef：让动画循环立刻能读到新值
        stateRef = {
          ...prev,
          temperature: nextTemp,
          pressure: nextPressure,
          rpm: nextRpm,
          efficiency: nextEfficiency,
          status: nextStatus,
          power: nextPower,
          output: nextOutput,
        }
        return stateRef
      })
    }, 1000)

    // ============================================================
    // 10. lil-gui 可视化调试面板（新增）
    // 把原本写死在代码里的"魔法数字"暴露成可拖动滑块/开关，实时观察效果
    // 调参路径：改 GUI 滑块 → tweakParams 实时更新 → 动画循环直接读取
    // ============================================================
    const tweakParams = {
      // ---- 旋转环 ----
      ringSpeed: 0.06,               // 旋转环角速度倍率
      ringPulseFreq: 3,              // 发光脉动频率
      ringPulseAmp: 0.4,             // 发光脉动幅度
      ringRingBaseEmissive: 0.5,     // 发光基底强度
      ringStopDim: 0.1,              // 停止时发光衰减系数

      // ---- 警示灯闪烁 ----
      errorBlinkFreq: 8,             // 故障闪烁频率（Hz * 2π）
      errorBlinkOpacity: 0.8,        // 故障闪烁最大不透明度
      errorBlightLight: 3,           // 故障闪烁灯光强度
      warnBlinkFreq: 4,              // 警告闪烁频率
      warnBlinkOpacity: 0.4,         // 警告闪烁最大不透明度
      warnBlightLight: 1.5,          // 警告闪烁灯光强度
      normalGlowOpacity: 0.05,       // 正常状态微弱发光

      // ---- 设备振动 ----
      vibFreq: 8,                    // 振动频率
      vibAmp: 0.02,                  // 振动幅度

      // ---- 传送带 / 货物 ----
      rollerSpeed: 0.08,             // 滚筒转速倍率
      boxSpeed: 4,                   // 货物移动速度（单位/秒）
      boxEmissiveFreq: 2,            // 货物发光脉动频率
      boxEmissiveAmp: 0.05,          // 货物发光脉动幅度

      // ---- 场景全局 ----
      showGrid: true,                // 显示网格
      showHelpers: true,             // 显示辅助线/提示
      mainLightIntensity: 0.8,       // 主光源强度
      ambientIntensity: 0.6,         // 环境光强度
      fillLightIntensity: 0.3,       // 补光强度
      fogEnabled: true,              // 雾效开关
      fogNear: 30,                   // 雾开始距离
      fogFar: 80,                    // 雾完全不透明距离
      bgColor: '#0d1117',            // 背景色（可通过调色板改）
    }

    const gui = new GUI({ title: '🛠️ 调试面板 (lil-gui)', width: 300 })
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '16px'
    gui.domElement.style.right = '16px'
    gui.domElement.style.zIndex = '9999'
    container.appendChild(gui.domElement)

    // ---- 文件夹：旋转环 ----
    const fRing = gui.addFolder('🔵 旋转环')
    fRing.add(tweakParams, 'ringSpeed', 0, 0.5, 0.001).name('转速倍率')
    fRing.add(tweakParams, 'ringPulseFreq', 0.1, 10, 0.1).name('脉动频率')
    fRing.add(tweakParams, 'ringPulseAmp', 0, 1, 0.01).name('脉动幅度')
    fRing.add(tweakParams, 'ringRingBaseEmissive', 0, 2, 0.01).name('基底发光')
    fRing.add(tweakParams, 'ringStopDim', 0, 1, 0.01).name('停止衰减')

    // ---- 文件夹：警示灯 ----
    const fWarn = gui.addFolder('🚨 警示灯')
    fWarn.add(tweakParams, 'errorBlinkFreq', 0.5, 20, 0.1).name('故障闪烁频率')
    fWarn.add(tweakParams, 'errorBlinkOpacity', 0, 1, 0.01).name('故障闪烁亮度')
    fWarn.add(tweakParams, 'errorBlightLight', 0, 10, 0.1).name('故障灯光强度')
    fWarn.add(tweakParams, 'warnBlinkFreq', 0.5, 15, 0.1).name('警告闪烁频率')
    fWarn.add(tweakParams, 'warnBlinkOpacity', 0, 1, 0.01).name('警告闪烁亮度')
    fWarn.add(tweakParams, 'warnBlightLight', 0, 10, 0.1).name('警告灯光强度')
    fWarn.add(tweakParams, 'normalGlowOpacity', 0, 0.3, 0.001).name('正常微弱发光')

    // ---- 文件夹：设备振动 ----
    const fVib = gui.addFolder('📳 设备振动')
    fVib.add(tweakParams, 'vibFreq', 0, 30, 0.1).name('振动频率')
    fVib.add(tweakParams, 'vibAmp', 0, 0.5, 0.001).name('振动幅度')

    // ---- 文件夹：传送带 / 货物 ----
    const fConv = gui.addFolder('📦 传送带 & 货物')
    fConv.add(tweakParams, 'rollerSpeed', 0, 0.5, 0.001).name('滚筒转速')
    fConv.add(tweakParams, 'boxSpeed', 0, 20, 0.1).name('货物移动速度')
    fConv.add(tweakParams, 'boxEmissiveFreq', 0, 10, 0.1).name('箱子发光频率')
    fConv.add(tweakParams, 'boxEmissiveAmp', 0, 0.5, 0.01).name('箱子发光幅度')

    // ---- 文件夹：场景光照 ----
    const fScene = gui.addFolder('💡 场景 & 光照')
    fScene.add(tweakParams, 'showGrid').name('显示网格').onChange((v: boolean) => gridHelper.visible = v)
    fScene.add(tweakParams, 'mainLightIntensity', 0, 3, 0.01).name('主光强度').onChange((v: number) => mainLight.intensity = v)
    fScene.add(tweakParams, 'ambientIntensity', 0, 2, 0.01).name('环境光强度').onChange((v: number) => ambientLight.intensity = v)
    fScene.add(tweakParams, 'fillLightIntensity', 0, 2, 0.01).name('补光强度').onChange((v: number) => fillLight.intensity = v)
    fScene.add(tweakParams, 'fogEnabled').name('雾效开关').onChange((v: boolean) => scene.fog = v ? new THREE.Fog(new THREE.Color(tweakParams.bgColor), tweakParams.fogNear, tweakParams.fogFar) : null)
    fScene.add(tweakParams, 'fogNear', 0, 100, 0.5).name('雾近距').onChange(() => {
      if (scene.fog) (scene.fog as THREE.Fog).near = tweakParams.fogNear
    })
    fScene.add(tweakParams, 'fogFar', 0, 200, 0.5).name('雾远距').onChange(() => {
      if (scene.fog) (scene.fog as THREE.Fog).far = tweakParams.fogFar
    })
    fScene.addColor(tweakParams, 'bgColor').name('背景色').onChange((v: string | number | THREE.Color) => {
      scene.background = new THREE.Color(v)
      if (scene.fog) (scene.fog as THREE.Fog).color.set(v)
    })

    // ---- 文件夹：数据模拟 ----
    const fData = gui.addFolder('📊 数据模拟阈值')
    fData.add(warnThresh, 'temp', 40, 120, 1).name('警告温度阈值')
    fData.add(warnThresh, 'pressure', 1, 5, 0.1).name('警告压力阈值')
    fData.add(warnThresh, 'efficiency', 40, 90, 1).name('警告效率阈值')
    fData.add(errThresh, 'temp', 50, 150, 1).name('故障温度阈值')
    fData.add(errThresh, 'pressure', 2, 6, 0.1).name('故障压力阈值')
    fData.add(errThresh, 'efficiency', 30, 80, 1).name('故障效率阈值')

    // 调试面板 - 快速强制切换状态（绕过 1 秒模拟）
    const fDebug = gui.addFolder('🎚️ 手动调试')
    fDebug.add(forceStatus, 'status', ['auto', 'normal', 'warning', 'error']).name('强制状态')
      .onChange((v: string) => {
        if (v === 'auto') return
        stateRef.status = v as any
        setMachineState(prev => ({ ...prev, status: v as any }))
      })
    fDebug.add({ override: () => {
      const hot = 110
      setMachineState(prev => ({ ...prev, temperature: hot }))
      stateRef.temperature = hot
    } }, 'override').name('🔥 强制过热 110°C')
    fDebug.add({ override: () => {
      setMachineState(prev => ({ ...prev, temperature: 50, pressure: 2, efficiency: 95, status: 'normal' }))
      stateRef.temperature = 50
      stateRef.pressure = 2
      stateRef.efficiency = 95
      stateRef.status = 'normal'
    } }, 'override').name('✅ 恢复正常')

    // ============================================================
    // 11. 动画主循环（每帧执行）
    // 所有 3D 对象的变化都集中在这里，按 stateRef 的值驱动
    // ============================================================
    let lastLogTime = 0   // 用于"每 5 秒一条运行日志"的时间戳记录
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const delta = clock.getDelta()          // 必须先取 delta！Three.js Clock 会在 getElapsedTime() 内部重置 delta
      const elapsed = clock.getElapsedTime()  // 再取累计时间（不影响后续使用）

      // ------------------------------
      // 11.1 遍历每台设备，更新旋转环 + 警示灯 + 振动（所有数字均来自 lil-gui 调试面板 tweakParams）
      // ------------------------------
      machinesRef.current.forEach((group, gi) => {
        // traverse：深度遍历 group 下所有子对象，找到 userData 打了标签的部件
        group.traverse((obj) => {
          const anyObj = obj as any

          // ---- 旋转环：运行时按速度旋转，并做呼吸发光 ----
          if (anyObj.userData?.isRing) {
            if (stateRef.running) {
              // 转速倍率 → tweakParams.ringSpeed (GUI 可调)
              obj.rotation.z += stateRef.speed * tweakParams.ringSpeed
            }
            // 发光呼吸脉动：频率/幅度/基底/停止衰减 全部来自 GUI
            const pulse = 0.8 + Math.sin(elapsed * tweakParams.ringPulseFreq + gi) * tweakParams.ringPulseAmp
            ;((obj as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
              tweakParams.ringRingBaseEmissive + pulse * tweakParams.ringPulseAmp * (stateRef.running ? 1 : tweakParams.ringStopDim)
          }

          // ---- 警示灯体 + 真实点光源：按状态等级闪烁（频率、亮度来自 GUI） ----
          if (anyObj.userData?.isGlow) {
            const light = anyObj.userData.light as THREE.PointLight
            if (stateRef.status === 'error') {
              // 故障：红色高频闪烁（频率来自 errorBlinkFreq）
              const blink = Math.sin(elapsed * tweakParams.errorBlinkFreq) > 0 ? 1 : 0
              ;((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = blink * tweakParams.errorBlinkOpacity
              light.intensity = blink * tweakParams.errorBlightLight
            } else if (stateRef.status === 'warning') {
              // 警告：黄色中速闪烁
              const blink = Math.sin(elapsed * tweakParams.warnBlinkFreq) > 0 ? 1 : 0
              ;((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = blink * tweakParams.warnBlinkOpacity
              light.intensity = blink * tweakParams.warnBlightLight
              light.color.setHex(0xffaa00)
              ;((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(0xffaa00)
            } else {
              // 正常：几乎不亮
              ;((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = tweakParams.normalGlowOpacity
              light.intensity = 0
            }
          }
        })

        // ---- 设备整体轻微上下振动：频率 vibFreq，振幅 vibAmp ----
        if (stateRef.running) {
          group.position.y = Math.sin(elapsed * tweakParams.vibFreq + gi * 2) * tweakParams.vibAmp * stateRef.speed
        }
      })

      // ------------------------------
      // 11.2 传送带滚筒滚动（rollerSpeed 可调）
      // ------------------------------
      conveyorGroup.traverse((obj) => {
        const anyObj = obj as any
        if (anyObj.userData?.isRoller) {
          if (stateRef.running) {
            obj.rotation.x += stateRef.speed * tweakParams.rollerSpeed
          }
        }
      })

      // ------------------------------
      // 11.3 货物箱循环移动（boxSpeed、发光频率/幅度 可调）
      // ------------------------------
      boxes.forEach((box, i) => {
        if (stateRef.running) {
          // delta * 基础速度 * 倍率 = 时间无关位移（帧率不同速度也一致）
          box.position.x += delta * tweakParams.boxSpeed * stateRef.speed
          // 超出右端就从左端循环回来
          if (box.position.x > 15) {
            box.position.x = -15
          }
        }
        // 箱子发光脉动：频率、幅度由 GUI 控制
        ;(box.material as THREE.MeshStandardMaterial).emissiveIntensity =
          Math.sin(elapsed * tweakParams.boxEmissiveFreq + i) * tweakParams.boxEmissiveAmp + tweakParams.boxEmissiveAmp
      })

      // ------------------------------
      // 11.4 每 5 秒随机产生一条运行日志
      // ------------------------------
      if (stateRef.running && elapsed - lastLogTime > 5) {
        lastLogTime = elapsed
        const events = [
          `已生产 ${Math.floor(stateRef.output).toLocaleString()} 件产品`,
          `能耗 ${stateRef.power.toFixed(1)} kW · 效率 ${stateRef.efficiency.toFixed(1)}%`,
          `传送带速度 ${(stateRef.speed * 100).toFixed(0)}% - 运行正常`,
        ]
        addLog(events[Math.floor(Math.random() * events.length)], 'info')
      }

      // 每帧必须更新 OrbitControls（阻尼效果）和渲染画面
      controls.update()
      renderer.render(scene, camera)
    }
    animate()   // 启动循环

    // ============================================================
    // 11. 响应式：窗口尺寸变化时重新设置相机宽高比
    // ============================================================
    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // 系统启动时的初始日志
    addLog('数字孪生系统启动成功', 'info')
    addLog('设备初始化完成，进入运行状态', 'info')

    // ============================================================
    // 12. 组件卸载清理（防止内存泄漏）
    // Three.js 场景里所有几何体、材质、纹理都需要手动 dispose()
    // ============================================================
    return () => {
      clearInterval(dataInterval)                          // 清除数据模拟定时器
      window.removeEventListener('resize', handleResize)   // 移除 resize 监听
      cancelAnimationFrame(frameIdRef.current)             // 取消动画循环
      gui.destroy()                                        // 销毁 lil-gui 面板（必须调用，否则 DOM 残留 + 事件未解绑）
      if (gui.domElement.parentNode) gui.domElement.parentNode.removeChild(gui.domElement)
      controls.dispose()                                   // 释放 OrbitControls
      renderer.dispose()                                   // 释放渲染器

      // 遍历场景中每个对象，释放几何体和材质
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })

      // 最后把 canvas DOM 节点从页面上移除
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [addLog])

  // ============================================================
  // 13. 交互逻辑：按钮 / 滑块事件
  // 注意：这些函数只改 React state，3D 画面通过 stateRef 桥接在下一帧动画循环中体现
  // ============================================================

  // 启动 / 停止切换
  const toggleRunning = () => {
    setMachineState((prev) => {
      const nextRunning = !prev.running
      addLog(nextRunning ? '设备已启动' : '设备已停止', nextRunning ? 'info' : 'warn')
      return { ...prev, running: nextRunning }
    })
  }

  // 速度滑块变更
  const setSpeed = (val: number) => {
    setMachineState((prev) => {
      addLog(`运行速度调整至 ${(val * 100).toFixed(0)}%`, 'info')
      return { ...prev, speed: val }
    })
  }

  // 系统重置：所有参数回到默认值，日志清空
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
    setLogs([])
    addLog('系统已重置', 'info')
  }

  // ----------------------------------------------------------
  // 状态配色：根据 status 返回徽章 / 指示灯的颜色
  // ----------------------------------------------------------
  const statusColors = {
    normal: { bg: '#065f46', text: '#34d399', border: '#10b981', label: '正常' },
    warning: { bg: '#78350f', text: '#fbbf24', border: '#f59e0b', label: '警告' },
    error: { bg: '#7f1d1d', text: '#f87171', border: '#ef4444', label: '故障' },
  }

  // ============================================================
  // 14. 数据卡片子组件：可复用的"指标 + 数值 + 进度条"展示单元
  // ============================================================
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
    // 如果传了 min/max，就把 value 映射为百分比 0~100
    const percent = min !== undefined && max !== undefined ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0
    return (
      <div style={styles.dataCard}>
        <div style={styles.dataCardTop}>
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span style={styles.dataCardLabel}>{label}</span>
        </div>
        <div style={styles.dataCardValueRow}>
          {/* 值 <10 时保留 1 位小数，否则显示整数（温度/压力是小数，其他是整数） */}
          <span style={{ ...styles.dataCardValue, color }}>{value.toFixed(value < 10 ? 1 : 0)}</span>
          <span style={styles.dataCardUnit}>{unit}</span>
        </div>
        {/* 进度条：颜色 + 发光光晕 */}
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

  // ============================================================
  // 15. JSX 渲染：页面整体结构
  // ============================================================
  return (
    <div style={styles.wrapper}>
      {/* ---------- 顶部 Header：标题 + 实时状态徽章 ---------- */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🏭</span>
          <div>
            <h1 style={styles.headerTitle}>数字孪生系统 · Digital Twin</h1>
            <p style={styles.headerSubtitle}>智能工厂实时监控与数字映射平台</p>
          </div>
        </div>
        {/* 状态徽章：颜色随 status 动态切换 */}
        <div style={{ ...styles.statusBadge, background: statusColors[machineState.status].bg, borderColor: statusColors[machineState.status].border }}>
          <span style={{ ...styles.statusDot, background: statusColors[machineState.status].text, boxShadow: `0 0 10px ${statusColors[machineState.status].text}` }} />
          <span style={{ ...styles.statusText, color: statusColors[machineState.status].text }}>
            {statusColors[machineState.status].label} · {machineState.running ? '运行中' : '已停止'}
          </span>
        </div>
      </div>

      {/* ---------- 主体：左侧 3D 画布 + 右侧侧栏 ---------- */}
      <div style={styles.main}>
        {/* 3D 画布区域 */}
        <div style={styles.canvasWrap}>
          <div ref={containerRef} style={styles.canvas} />
          {/* 悬浮提示：操作说明 */}
          <div style={styles.canvasOverlay}>
            <div style={styles.overlayTip}>🖱️ 拖拽旋转 · 滚轮缩放</div>
          </div>
        </div>

        {/* 右侧侧栏：控制 / 数据 / 日志 / 说明 */}
        <aside style={styles.sidebar}>
          {/* 控制区 */}
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>🎛️ 设备控制</h3>
            <div style={styles.controlRow}>
              <button
                style={{
                  ...styles.ctrlBtn,
                  background: machineState.running ? 'linear-gradient(135deg,#065f46,#10b981)' : 'linear-gradient(135deg,#7f1d1d,#ef4444)',
                  boxShadow: machineState.running ? '0 4px 20px #10b98166' : '0 4px 20px #ef444466',
                }}
                onClick={toggleRunning}
              >
                {machineState.running ? '⏸ 停止运行' : '▶ 启动运行'}
              </button>
              <button style={{ ...styles.ctrlBtn, ...styles.ctrlBtnSec }} onClick={resetSystem}>
                ↺ 重置
              </button>
            </div>

            {/* 速度滑块 */}
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

          {/* 6 项实时数据卡片网格 */}
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>📊 实时数据</h3>
            <div style={styles.dataGrid}>
              <DataCard label="温度" value={machineState.temperature} unit="°C" color="#f87171" icon="🌡️" min={0} max={120} />
              <DataCard label="压力" value={machineState.pressure} unit="MPa" color="#fb923c" icon="💨" min={0} max={5} />
              <DataCard label="转速" value={machineState.rpm} unit="RPM" color="#34d399" icon="⚙️" min={0} max={3600} />
              <DataCard label="效率" value={machineState.efficiency} unit="%" color="#60a5fa" icon="📈" min={0} max={100} />
              <DataCard label="功率" value={machineState.power} unit="kW" color="#a78bfa" icon="⚡" min={0} max={100} />
              <DataCard label="产量" value={machineState.output} unit="件/h" color="#f472b6" icon="📦" min={0} max={3000} />
            </div>
          </section>

          {/* 系统日志 */}
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
                        background: log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#3b82f6',
                      }}
                    />
                    <span style={styles.logMsg}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 底部关于说明（用 marginTop:auto 贴在侧边栏底部） */}
          <section style={{ ...styles.panel, ...styles.aboutPanel }}>
            <h4 style={styles.aboutTitle}>💡 关于数字孪生</h4>
            <p style={styles.aboutText}>
              数字孪生通过对物理实体进行数字化建模，实时同步运行数据，实现预测性维护、效率优化与智能决策。
              左侧 3D 场景为车间数字映射，右侧为同步的运行状态数据。
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

// ============================================================
// 16. 内联样式表（避免额外 CSS 文件，保持单文件组件）
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
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
    position: 'relative',   // 给 lil-gui 的 absolute 定位提供参照物
  },
  canvasOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    pointerEvents: 'none',   // 让鼠标事件穿透到下面的 canvas
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
    background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(124,58,237,0.08))',
    border: '1px solid rgba(59,130,246,0.2)',
  },
  aboutTitle: {
    margin: '0 0 8px',
    fontSize: '13px',
    color: '#93c5fd',
  },
  aboutText: {
    margin: 0,
    fontSize: '12px',
    color: '#8b949e',
    lineHeight: 1.7,
  },
}

export default DigitalTwin
