import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const LightingShadows = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)
  const controlsRef = useRef<OrbitControls | null>(null)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null)
  const pointLightRef = useRef<THREE.PointLight | null>(null)
  const spotLightRef = useRef<THREE.SpotLight | null>(null)
  const meshesRef = useRef<THREE.Mesh[]>([])
  const geometriesRef = useRef<THREE.BufferGeometry[]>([])
  const materialsRef = useRef<THREE.Material[]>([])

  const [ambientOn, setAmbientOn] = useState(true)
  const [directionalOn, setDirectionalOn] = useState(true)
  const [pointOn, setPointOn] = useState(true)
  const [spotOn, setSpotOn] = useState(true)
  const [shadowQuality, setShadowQuality] = useState<'low' | 'medium' | 'high'>('medium')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f1e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 6, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -15
    directionalLight.shadow.camera.right = 15
    directionalLight.shadow.camera.top = 15
    directionalLight.shadow.camera.bottom = -15
    directionalLight.shadow.bias = -0.0001
    scene.add(directionalLight)
    directionalLightRef.current = directionalLight

    const dirHelperGeo = new THREE.SphereGeometry(0.25, 16, 16)
    const dirHelperMat = new THREE.MeshBasicMaterial({ color: 0xffff88 })
    const dirHelper = new THREE.Mesh(dirHelperGeo, dirHelperMat)
    dirHelper.position.copy(directionalLight.position)
    scene.add(dirHelper)
    geometriesRef.current.push(dirHelperGeo)
    materialsRef.current.push(dirHelperMat)

    const pointLight = new THREE.PointLight(0xff6b6b, 1.5, 30)
    pointLight.position.set(-4, 4, 2)
    pointLight.castShadow = false
    scene.add(pointLight)
    pointLightRef.current = pointLight

    const pointHelperGeo = new THREE.SphereGeometry(0.25, 16, 16)
    const pointHelperMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b })
    const pointHelper = new THREE.Mesh(pointHelperGeo, pointHelperMat)
    pointHelper.position.copy(pointLight.position)
    scene.add(pointHelper)
    geometriesRef.current.push(pointHelperGeo)
    materialsRef.current.push(pointHelperMat)

    const spotLight = new THREE.SpotLight(0x4ecdc4, 2, 30, Math.PI / 6, 0.4, 1)
    spotLight.position.set(4, 8, -4)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.width = 2048
    spotLight.shadow.mapSize.height = 2048
    spotLight.shadow.camera.near = 1
    spotLight.shadow.camera.far = 30
    spotLight.shadow.bias = -0.0001
    scene.add(spotLight)
    scene.add(spotLight.target)
    spotLight.target.position.set(0, 0, 0)
    spotLightRef.current = spotLight

    const spotHelperGeo = new THREE.SphereGeometry(0.25, 16, 16)
    const spotHelperMat = new THREE.MeshBasicMaterial({ color: 0x4ecdc4 })
    const spotHelper = new THREE.Mesh(spotHelperGeo, spotHelperMat)
    spotHelper.position.copy(spotLight.position)
    scene.add(spotHelper)
    geometriesRef.current.push(spotHelperGeo)
    materialsRef.current.push(spotHelperMat)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 5
    controls.maxDistance = 35
    controls.target.set(0, 1, 0)
    controlsRef.current = controls

    const boxGeo = new THREE.BoxGeometry(2, 2, 2)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.3, roughness: 0.5 })
    const box = new THREE.Mesh(boxGeo, boxMat)
    box.position.set(-3, 1, 0)
    box.castShadow = true
    box.receiveShadow = true
    scene.add(box)
    meshesRef.current.push(box)
    geometriesRef.current.push(boxGeo)
    materialsRef.current.push(boxMat)

    const sphereGeo = new THREE.SphereGeometry(1.2, 64, 64)
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffe66d, metalness: 0.2, roughness: 0.3 })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.set(0, 1.2, 1)
    sphere.castShadow = true
    sphere.receiveShadow = true
    scene.add(sphere)
    meshesRef.current.push(sphere)
    geometriesRef.current.push(sphereGeo)
    materialsRef.current.push(sphereMat)

    const torusGeo = new THREE.TorusGeometry(1, 0.35, 24, 100)
    const torusMat = new THREE.MeshStandardMaterial({ color: 0xa29bfe, metalness: 0.6, roughness: 0.2 })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    torus.position.set(3.5, 1.3, -0.5)
    torus.rotation.x = Math.PI / 3
    torus.castShadow = true
    torus.receiveShadow = true
    scene.add(torus)
    meshesRef.current.push(torus)
    geometriesRef.current.push(torusGeo)
    materialsRef.current.push(torusMat)

    const smallBoxGeo = new THREE.BoxGeometry(1, 1, 1)
    const smallBoxMat = new THREE.MeshStandardMaterial({ color: 0x00b894, metalness: 0.1, roughness: 0.6 })
    const smallBox = new THREE.Mesh(smallBoxGeo, smallBoxMat)
    smallBox.position.set(1.5, 0.5, 2.5)
    smallBox.castShadow = true
    smallBox.receiveShadow = true
    scene.add(smallBox)
    meshesRef.current.push(smallBox)
    geometriesRef.current.push(smallBoxGeo)
    materialsRef.current.push(smallBoxMat)

    const groundGeo = new THREE.PlaneGeometry(40, 40)
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

    const gridHelper = new THREE.GridHelper(40, 40, 0x444466, 0x2a2a44)
    gridHelper.position.y = 0.001
    scene.add(gridHelper)

    const clock = new THREE.Clock()

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      if (pointLightRef.current) {
        pointLightRef.current.position.x = Math.cos(elapsed * 0.8) * 4.5
        pointLightRef.current.position.z = Math.sin(elapsed * 0.8) * 4.5
        pointHelper.position.copy(pointLightRef.current.position)
      }

      box.rotation.y += 0.008
      torus.rotation.z += 0.01
      smallBox.rotation.y += 0.012
      smallBox.position.y = 0.5 + Math.sin(elapsed * 2) * 0.2

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

    return () => {
      window.removeEventListener('resize', handleResize)
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

  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = ambientOn ? 0.5 : 0
    }
  }, [ambientOn])

  useEffect(() => {
    if (directionalLightRef.current) {
      directionalLightRef.current.intensity = directionalOn ? 1.2 : 0
    }
  }, [directionalOn])

  useEffect(() => {
    if (pointLightRef.current) {
      pointLightRef.current.intensity = pointOn ? 1.5 : 0
    }
  }, [pointOn])

  useEffect(() => {
    if (spotLightRef.current) {
      spotLightRef.current.intensity = spotOn ? 2 : 0
    }
  }, [spotOn])

  useEffect(() => {
    const sizeMap = { low: 512, medium: 2048, high: 4096 }
    const size = sizeMap[shadowQuality]

    if (directionalLightRef.current) {
      directionalLightRef.current.shadow.mapSize.width = size
      directionalLightRef.current.shadow.mapSize.height = size
      directionalLightRef.current.shadow.map?.dispose()
    }
    if (spotLightRef.current) {
      spotLightRef.current.shadow.mapSize.width = size
      spotLightRef.current.shadow.mapSize.height = size
      spotLightRef.current.shadow.map?.dispose()
    }
  }, [shadowQuality])

  const toggleBtns = [
    { key: 'ambient', label: '💡 环境光', active: ambientOn, onClick: () => setAmbientOn(!ambientOn), color: '#888888' },
    { key: 'directional', label: '☀️ 方向光', active: directionalOn, onClick: () => setDirectionalOn(!directionalOn), color: '#ffff88' },
    { key: 'point', label: '🔴 点光源', active: pointOn, onClick: () => setPointOn(!pointOn), color: '#ff6b6b' },
    { key: 'spot', label: '🔦 聚光灯', active: spotOn, onClick: () => setSpotOn(!spotOn), color: '#4ecdc4' },
  ]

  const qualityBtns: { key: 'low' | 'medium' | 'high'; label: string }[] = [
    { key: 'low', label: '低 512' },
    { key: 'medium', label: '中 2048' },
    { key: 'high', label: '高 4096' },
  ]

  return (
    <div style={styles.wrapper}>
      <div style={styles.canvasWrapper}>
        <div style={styles.controlsBar}>
          <div style={styles.controlGroup}>
            <span style={styles.controlLabel}>光源开关：</span>
            <div style={styles.btnRow}>
              {toggleBtns.map(btn => (
                <button
                  key={btn.key}
                  onClick={btn.onClick}
                  style={{
                    ...styles.toggleBtn,
                    background: btn.active ? `${btn.color}33` : 'rgba(255,255,255,0.06)',
                    borderColor: btn.active ? btn.color : 'transparent',
                    color: btn.active ? btn.color : '#888',
                    opacity: btn.active ? 1 : 0.6,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.controlGroup}>
            <span style={styles.controlLabel}>阴影清晰度：</span>
            <div style={styles.btnRow}>
              {qualityBtns.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setShadowQuality(btn.key)}
                  style={{
                    ...styles.toggleBtn,
                    background: shadowQuality === btn.key ? 'rgba(162,155,254,0.25)' : 'rgba(255,255,255,0.06)',
                    borderColor: shadowQuality === btn.key ? '#a29bfe' : 'transparent',
                    color: shadowQuality === btn.key ? '#a29bfe' : '#888',
                    fontWeight: shadowQuality === btn.key ? 600 : 400,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div ref={containerRef} style={styles.canvas} />
      </div>

      <aside style={styles.panel}>
        <h2 style={styles.title}>光照与阴影</h2>
        <p style={styles.subtitle}>Lighting & Shadows</p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>💡 四种光源类型</h3>

          <div style={styles.lightItem}>
            <strong style={{ color: '#ccc' }}>AmbientLight 环境光</strong>
            <p style={styles.itemDesc}>
              均匀照亮场景中所有物体，无方向、无阴影。用于提供整体基础亮度，避免完全黑暗的区域。
            </p>
            <code style={styles.code}>
              new THREE.AmbientLight(0x404060, 0.5)
            </code>
          </div>

          <div style={styles.lightItem}>
            <strong style={{ color: '#ffff88' }}>DirectionalLight 方向光</strong>
            <p style={styles.itemDesc}>
              模拟太阳光，光线从无限远的位置平行照射。有方向、有阴影，适合室外场景。
            </p>
            <code style={styles.code}>
              directionalLight.castShadow = true{'\n'}
              shadow.mapSize = 2048 x 2048
            </code>
          </div>

          <div style={styles.lightItem}>
            <strong style={{ color: '#ff6b6b' }}>PointLight 点光源</strong>
            <p style={styles.itemDesc}>
              从一个点向四周发射光线，类似灯泡。距离越远光照越弱（衰减）。
            </p>
            <code style={styles.code}>
              new THREE.PointLight(color, intensity, distance)
            </code>
          </div>

          <div style={styles.lightItem}>
            <strong style={{ color: '#4ecdc4' }}>SpotLight 聚光灯</strong>
            <p style={styles.itemDesc}>
              锥形光束，类似手电筒/舞台灯。有照射角度(angle)、边缘柔和度(penumbra)参数。
            </p>
            <code style={styles.code}>
              spotLight.angle = Math.PI / 6{'\n'}
              spotLight.penumbra = 0.4
            </code>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🌑 阴影工作原理</h3>

          <div style={styles.principleBox}>
            <h4 style={{ color: '#ffe66d', margin: '0 0 8px' }}>Shadow Map 算法</h4>
            <p style={styles.itemDesc}>
              1. 从光源视角渲染场景，生成深度纹理（Shadow Map）<br />
              2. 正常渲染时，比较像素到光源的距离与 Shadow Map 中的深度<br />
              3. 若像素更远，则处于阴影中
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <code style={styles.code}>
              {`// 开启阴影映射
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// 光源投射阴影
light.castShadow = true

// 物体：投射阴影
mesh.castShadow = true
// 物体：接收阴影（显示阴影）
mesh.receiveShadow = true`}
            </code>
          </div>

          <ul style={styles.list}>
            <li><strong>castShadow</strong>: 物体是否投射阴影到其他物体</li>
            <li><strong>receiveShadow</strong>: 物体表面是否显示其他物体的阴影</li>
            <li><strong>PCFSoftShadowMap</strong>: 百分比过滤软阴影，边缘更柔和</li>
            <li><strong>mapSize</strong>: 阴影贴图尺寸，越大越清晰，开销越高</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎨 可视化小球图例</h3>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: '#ffff88' }} />
            <span>方向光（上方偏右）</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: '#ff6b6b' }} />
            <span>点光源（绕场景运动）</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: '#4ecdc4' }} />
            <span>聚光灯（右上方）</span>
          </div>
        </section>

        <div style={styles.tipBox}>
          <h4 style={{ margin: '0 0 8px', color: '#4ecdc4' }}>💡 操作提示</h4>
          <ul style={{ ...styles.list, margin: 0 }}>
            <li>拖拽上方按钮切换光源，观察阴影变化</li>
            <li>调整阴影清晰度对比画质差异</li>
            <li>鼠标左键旋转，右键平移，滚轮缩放</li>
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
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  controlsBar: {
    padding: '14px 24px',
    background: 'rgba(15,15,30,0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  controlLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 500,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    padding: '7px 14px',
    borderRadius: 6,
    border: '2px solid transparent',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  canvas: {
    flex: 1,
    background: '#0f0f1e',
    position: 'relative',
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
    margin: '0 0 14px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffe66d',
  },
  lightItem: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: '1px dashed rgba(255,255,255,0.08)',
  },
  itemDesc: {
    margin: '6px 0 10px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#c0c0d8',
  },
  code: {
    display: 'block',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
    overflowX: 'auto',
    lineHeight: 1.6,
    whiteSpace: 'pre',
  },
  list: {
    margin: '14px 0 0',
    paddingLeft: '18px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#c0c0d8',
  },
  principleBox: {
    padding: '12px 14px',
    background: 'rgba(255,230,109,0.08)',
    borderRadius: 8,
    border: '1px solid rgba(255,230,109,0.2)',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#c0c0d8',
    padding: '6px 0',
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    boxShadow: '0 0 10px currentColor',
  },
  tipBox: {
    padding: '14px 16px',
    background: 'rgba(78,205,196,0.1)',
    borderRadius: 10,
    border: '1px solid rgba(78,205,196,0.3)',
  },
}

export default LightingShadows
