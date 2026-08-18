import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type AnimType = 'rotate' | 'float' | 'orbit'

interface CubeData {
  mesh: THREE.Mesh
  basePosition: THREE.Vector3
  baseColor: THREE.Color
  animType: AnimType
  orbitRadius: number
  orbitSpeed: number
  floatSpeed: number
  floatOffset: number
  rotateSpeed: THREE.Vector3
  jumpVelocity: number
  isJumping: boolean
  originalScale: number
}

const AnimationInteraction = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const fpsRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cubesRef = useRef<CubeData[]>([])
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const hoveredCubeRef = useRef<CubeData | null>(null)
  const geometriesRef = useRef<THREE.BufferGeometry[]>([])
  const materialsRef = useRef<THREE.Material[]>([])

  const [hoveredInfo, setHoveredInfo] = useState<string>('')
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f1e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000)
    camera.position.set(0, 8, 16)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1)
    directionalLight.position.set(6, 12, 8)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 60
    directionalLight.shadow.camera.left = -20
    directionalLight.shadow.camera.right = 20
    directionalLight.shadow.camera.top = 20
    directionalLight.shadow.camera.bottom = -20
    scene.add(directionalLight)

    const pointLight = new THREE.PointLight(0x4ecdc4, 1, 50)
    pointLight.position.set(-8, 6, -6)
    scene.add(pointLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 6
    controls.maxDistance = 40
    controls.target.set(0, 1.5, 0)
    controlsRef.current = controls

    const colorPalette = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa29bfe, 0xfd79a8, 0x00b894, 0x6c5ce7, 0xe17055, 0x74b9ff, 0x55efc4, 0xff7675, 0xe84393]

    const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
    geometriesRef.current.push(boxGeo)
    const cubeCount = 12
    const animTypes: AnimType[] = ['rotate', 'float', 'orbit']

    for (let i = 0; i < cubeCount; i++) {
      const colorHex = colorPalette[i % colorPalette.length]
      const color = new THREE.Color(colorHex)
      const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.25,
        roughness: 0.4,
      })
      materialsRef.current.push(material)

      const mesh = new THREE.Mesh(boxGeo, material)

      const angle = (i / cubeCount) * Math.PI * 2
      const radius = 4.5 + Math.random() * 3.5
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = 0.6 + Math.random() * 3

      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true

      const scale = 0.7 + Math.random() * 0.8
      mesh.scale.setScalar(scale)

      scene.add(mesh)

      const animType = animTypes[i % 3]

      cubesRef.current.push({
        mesh,
        basePosition: mesh.position.clone(),
        baseColor: color.clone(),
        animType,
        orbitRadius: 1 + Math.random() * 1.5,
        orbitSpeed: 0.3 + Math.random() * 0.6,
        floatSpeed: 0.8 + Math.random() * 1.2,
        floatOffset: Math.random() * Math.PI * 2,
        rotateSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        ),
        jumpVelocity: 0,
        isJumping: false,
        originalScale: scale,
      })
    }

    const groundGeo = new THREE.PlaneGeometry(50, 50)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.05,
      roughness: 0.95,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    scene.add(ground)
    geometriesRef.current.push(groundGeo)
    materialsRef.current.push(groundMat)

    const gridHelper = new THREE.GridHelper(40, 40, 0x3a3a5a, 0x222244)
    gridHelper.position.y = 0.001
    scene.add(gridHelper)

    const clock = new THREE.Clock()
    let lastTime = performance.now()
    let frameCount = 0
    let fpsTimer = 0

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)

      const delta = clock.getDelta()
      const elapsed = clock.getElapsedTime()

      frameCount++
      fpsTimer += delta
      if (fpsTimer >= 0.5) {
        const now = performance.now()
        const elapsedMs = now - lastTime
        if (elapsedMs > 0) {
          const currentFps = Math.round((frameCount * 1000) / elapsedMs)
          setFps(currentFps)
        }
        lastTime = now
        frameCount = 0
        fpsTimer = 0
      }

      cubesRef.current.forEach((cube, idx) => {
        const mesh = cube.mesh
        const basePos = cube.basePosition

        switch (cube.animType) {
          case 'rotate':
            mesh.rotation.x += cube.rotateSpeed.x * delta
            mesh.rotation.y += cube.rotateSpeed.y * delta
            mesh.rotation.z += cube.rotateSpeed.z * delta
            break

          case 'float':
            mesh.rotation.y += cube.rotateSpeed.y * delta
            mesh.position.y = basePos.y + Math.sin(elapsed * cube.floatSpeed + cube.floatOffset) * 0.5
            break

          case 'orbit':
            mesh.rotation.y += cube.rotateSpeed.y * delta
            const orbitAngle = elapsed * cube.orbitSpeed + idx * 0.3
            mesh.position.x = basePos.x + Math.cos(orbitAngle) * cube.orbitRadius
            mesh.position.z = basePos.z + Math.sin(orbitAngle) * cube.orbitRadius
            break
        }

        if (cube.isJumping) {
          cube.jumpVelocity -= 25 * delta
          mesh.position.y += cube.jumpVelocity * delta
          const groundY = cube.basePosition.y
          if (mesh.position.y <= groundY) {
            mesh.position.y = groundY
            cube.isJumping = false
            cube.jumpVelocity = 0
          }
        }
      })

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    const updateMouseNDC = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    const checkIntersection = (): CubeData | null => {
      const meshes = cubesRef.current.map(c => c.mesh)
      raycasterRef.current.setFromCamera(mouseRef.current, camera)
      const intersects = raycasterRef.current.intersectObjects(meshes, false)
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh
        return cubesRef.current.find(c => c.mesh === hitMesh) || null
      }
      return null
    }

    const setHovered = (cube: CubeData | null) => {
      if (hoveredCubeRef.current === cube) return

      if (hoveredCubeRef.current) {
        const prev = hoveredCubeRef.current
        ;(prev.mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(0x000000)
        ;(prev.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0
        prev.mesh.scale.setScalar(prev.originalScale)
      }

      hoveredCubeRef.current = cube

      if (cube) {
        const mat = cube.mesh.material as THREE.MeshStandardMaterial
        mat.emissive?.copy(cube.baseColor)
        mat.emissiveIntensity = 0.5
        cube.mesh.scale.setScalar(cube.originalScale * 1.25)

        const animLabels = { rotate: '自转型', float: '浮动型', orbit: '轨道型' }
        setHoveredInfo(`立方体 #${cubesRef.current.indexOf(cube) + 1} | ${animLabels[cube.animType]}`)
        container.style.cursor = 'pointer'
      } else {
        setShowTooltip(false)
        container.style.cursor = 'default'
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!container.contains(event.target as Node)) return
      updateMouseNDC(event)
      const hit = checkIntersection()
      setHovered(hit)

      setTooltipPos({ x: event.clientX, y: event.clientY })
      if (hit) setShowTooltip(true)
      else setShowTooltip(false)
    }

    const handleClick = (event: MouseEvent) => {
      if (!container.contains(event.target as Node)) return
      updateMouseNDC(event)
      const hit = checkIntersection()
      if (hit && !hit.isJumping) {
        hit.isJumping = true
        hit.jumpVelocity = 10

        const mat = hit.mesh.material as THREE.MeshStandardMaterial
        const newColor = new THREE.Color().setHSL(Math.random(), 0.75, 0.6)
        mat.color.copy(newColor)
        hit.baseColor.copy(newColor)
        if (hoveredCubeRef.current === hit) {
          mat.emissive?.copy(newColor)
        }
      }
    }

    const handleMouseLeave = () => {
      setHovered(null)
      setShowTooltip(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      container.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(frameIdRef.current)
      controls.dispose()
      geometriesRef.current.forEach(g => g.dispose())
      materialsRef.current.forEach(m => m.dispose())
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div style={styles.wrapper}>
      <div style={styles.canvasWrapper}>
        <div ref={containerRef} style={styles.canvas} />

        <div ref={fpsRef} style={styles.fpsBox}>
          <div style={styles.fpsLabel}>FPS</div>
          <div style={{
            ...styles.fpsValue,
            color: fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffe66d' : '#ff6b6b',
          }}>
            {fps}
          </div>
        </div>

        {showTooltip && (
          <div
            ref={tooltipRef}
            style={{
              ...styles.tooltip,
              left: tooltipPos.x + 14,
              top: tooltipPos.y + 14,
            }}
          >
            {hoveredInfo}
          </div>
        )}
      </div>

      <aside style={styles.panel}>
        <h2 style={styles.title}>动画与交互</h2>
        <p style={styles.subtitle}>Animation & Mouse Interaction</p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>⏱️ THREE.Clock 时间管理</h3>
          <p style={styles.sectionText}>
            使用 Clock 计算帧间<strong style={{color: '#fff'}}>delta time</strong>（Δt），
            让动画速度与帧率无关，确保在不同设备上表现一致。
          </p>
          <code style={styles.code}>
{`const clock = new THREE.Clock()

const animate = () => {
  const delta = clock.getDelta()
  const elapsed = clock.getElapsedTime()

  // 基于时间的旋转（秒为单位）
  mesh.rotation.y += 2 * delta  // 每秒2弧度
  // 不推荐： += 0.01  // 依赖帧率`}
          </code>
          <ul style={styles.list}>
            <li><strong>getDelta()</strong>: 距上次调用的秒数</li>
            <li><strong>getElapsedTime()</strong>: 启动后的总秒数</li>
            <li>利用 delta 实现<strong style={{color: '#ffe66d'}}>帧率无关</strong>的动画</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎯 Raycaster 射线检测</h3>
          <p style={styles.sectionText}>
            从摄像机发出一条射线，检测穿过的物体，实现鼠标拾取（Pick）。
          </p>
          <div style={styles.highlightBox}>
            <h4 style={{color: '#4ecdc4', margin: '0 0 10px'}}>NDC 坐标转换</h4>
            <p style={styles.itemDesc}>
              鼠标屏幕坐标 (0~宽/高) 需先归一化到 <strong style={{color: '#fff'}}>[-1, 1]</strong> 的 NDC 空间：
            </p>
          </div>
          <code style={styles.code}>
{`// 将鼠标坐标转为 NDC（归一化设备坐标）
mouse.x = (x / width) * 2 - 1
mouse.y = -(y / height) * 2 + 1

// 射线从相机经过鼠标点
raycaster.setFromCamera(mouse, camera)

// 检测相交物体
const hits = raycaster.intersectObjects(meshes)`}
          </code>
          <ul style={styles.list}>
            <li><strong>intersectObjects</strong>: 返回所有命中对象数组</li>
            <li>结果包含<strong style={{color: '#ffe66d'}}>距离、交点、面、UV</strong>等信息</li>
            <li>可用于悬停高亮、点击选择、拖拽等交互</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🔄 requestAnimationFrame</h3>
          <p style={styles.sectionText}>
            浏览器提供的高效动画循环，与显示器刷新率同步（通常 60fps）。
          </p>
          <code style={styles.code}>
{`const animate = () => {
  requestAnimationFrame(animate)
  // 更新物体状态
  controls.update()
  renderer.render(scene, camera)
}
animate()`}
          </code>
          <ul style={styles.list}>
            <li>标签页不可见时<strong style={{color: '#ffe66d'}}>自动暂停</strong>，节省 CPU</li>
            <li>配合 Clock.getDelta() 实现一致速度</li>
            <li>卸载时调用 cancelAnimationFrame 清理</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎲 三种动画模式</h3>
          <div style={styles.animLegend}>
            <div style={{...styles.animDot, background: '#ff6b6b'}} />
            <div>
              <strong>自转型</strong>
              <span style={{color: '#999'}}> — 三个轴同时旋转</span>
            </div>
          </div>
          <div style={styles.animLegend}>
            <div style={{...styles.animDot, background: '#4ecdc4'}} />
            <div>
              <strong>浮动型</strong>
              <span style={{color: '#999'}}> — 正弦函数上下漂浮</span>
            </div>
          </div>
          <div style={styles.animLegend}>
            <div style={{...styles.animDot, background: '#a29bfe'}} />
            <div>
              <strong>轨道型</strong>
              <span style={{color: '#999'}}> — 围绕基点做圆周运动</span>
            </div>
          </div>
        </section>

        <div style={styles.tipBox}>
          <h4 style={{margin: '0 0 10px', color: '#00b894'}}>🎮 交互操作</h4>
          <ul style={{...styles.list, margin: 0}}>
            <li><strong>悬停</strong>立方体：高亮放大 + 显示提示</li>
            <li><strong>点击</strong>立方体：弹跳 + 随机变色</li>
            <li>鼠标拖拽：旋转视角</li>
            <li>滚轮：缩放视图</li>
            <li>右上角：实时 FPS 监测</li>
          </ul>
        </div>
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
    fontFamily: 'system-ui, sans-serif',
  },
  canvasWrapper: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
  },
  canvas: {
    width: '100%',
    height: '100%',
    background: '#0f0f1e',
  },
  fpsBox: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: '10px 16px',
    background: 'rgba(15,15,30,0.85)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 68,
    pointerEvents: 'none',
  },
  fpsLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#888',
    fontWeight: 600,
  },
  fpsValue: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  tooltip: {
    position: 'fixed',
    padding: '7px 14px',
    background: 'rgba(20,20,40,0.95)',
    color: '#fff',
    borderRadius: 6,
    fontSize: 13,
    pointerEvents: 'none',
    zIndex: 9999,
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },
  panel: {
    width: '400px',
    minWidth: '400px',
    padding: '24px 28px',
    background: 'linear-gradient(180deg, #16213e 0%, #0f3460 100%)',
    color: '#eaeaea',
    overflowY: 'auto',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    boxSizing: 'border-box',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '4px 0 24px',
    fontSize: '13px',
    color: '#a0a0c0',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: '22px',
    padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#a29bfe',
  },
  sectionText: {
    margin: '0 0 12px',
    fontSize: '13px',
    lineHeight: 1.65,
    color: '#c0c0d8',
  },
  code: {
    display: 'block',
    padding: '12px 14px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
    overflowX: 'auto',
    lineHeight: 1.65,
    whiteSpace: 'pre',
  },
  list: {
    margin: '12px 0 0',
    paddingLeft: '18px',
    fontSize: '12.5px',
    lineHeight: 1.8,
    color: '#c0c0d8',
  },
  highlightBox: {
    padding: '12px 14px',
    background: 'rgba(78,205,196,0.08)',
    borderRadius: 8,
    border: '1px solid rgba(78,205,196,0.2)',
    marginBottom: 12,
  },
  itemDesc: {
    margin: 0,
    fontSize: '12.5px',
    lineHeight: 1.65,
    color: '#c0c0d8',
  },
  animLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    fontSize: '13px',
    color: '#e0e0f0',
  },
  animDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    flexShrink: 0,
    boxShadow: '0 0 10px currentColor',
  },
  tipBox: {
    padding: '14px 16px',
    background: 'rgba(0,184,148,0.1)',
    borderRadius: 10,
    border: '1px solid rgba(0,184,148,0.3)',
  },
}

export default AnimationInteraction
