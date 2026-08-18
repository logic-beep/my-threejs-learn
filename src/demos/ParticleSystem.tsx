import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const ParticleSystem = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a1a)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 0, 12)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 3
    controls.maxDistance = 40

    const particleCount = 8000
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const originalPositions = new Float32Array(particleCount * 3)
    const normals = new Float32Array(particleCount * 3)
    const randomOffsets = new Float32Array(particleCount)

    const radius = 5
    const color = new THREE.Color()

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * Math.cbrt(Math.random())

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

      positions[i3] = x
      positions[i3 + 1] = y
      positions[i3 + 2] = z

      originalPositions[i3] = x
      originalPositions[i3 + 1] = y
      originalPositions[i3 + 2] = z

      const len = Math.sqrt(x * x + y * y + z * z) || 1
      normals[i3] = x / len
      normals[i3 + 1] = y / len
      normals[i3 + 2] = z / len

      color.setHSL(Math.random(), 0.8, 0.6)
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b

      randomOffsets[i] = Math.random() * Math.PI * 2
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const mouse = new THREE.Vector2(9999, 9999)
    const raycaster = new THREE.Raycaster()
    const mouseWorldPos = new THREE.Vector3()

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const distance = camera.position.length()
      mouseWorldPos.copy(raycaster.ray.origin).add(
        raycaster.ray.direction.multiplyScalar(distance * 0.5)
      )
    }
    renderer.domElement.addEventListener('mousemove', handleMouseMove)

    const handleMouseLeave = () => {
      mouse.set(9999, 9999)
      mouseWorldPos.set(9999, 9999, 9999)
    }
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave)

    const clock = new THREE.Clock()

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)

      const elapsed = clock.getElapsedTime()
      const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const posArray = positionAttr.array as Float32Array

      const attractRadius = 3
      const attractStrength = 0.5

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3

        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]

        const nx = normals[i3]
        const ny = normals[i3 + 1]
        const nz = normals[i3 + 2]

        const pulse = Math.sin(elapsed * 1.5 + randomOffsets[i]) * 0.15

        let px = ox + nx * pulse
        let py = oy + ny * pulse
        let pz = oz + nz * pulse

        const dx = mouseWorldPos.x - px
        const dy = mouseWorldPos.y - py
        const dz = mouseWorldPos.z - pz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < attractRadius && mouseWorldPos.x < 999) {
          const force = (1 - dist / attractRadius) * attractStrength
          px += dx * force
          py += dy * force
          pz += dz * force
        }

        posArray[i3] = px
        posArray[i3 + 1] = py
        posArray[i3 + 2] = pz
      }
      positionAttr.needsUpdate = true

      points.rotation.y = elapsed * 0.1
      points.rotation.x = Math.sin(elapsed * 0.05) * 0.1

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
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      renderer.domElement.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(frameIdRef.current)
      controls.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas} />
      <aside style={styles.panel}>
        <h2 style={styles.title}>✨ 粒子系统 Particle System</h2>
        <p style={styles.subtitle}>高效渲染大量顶点的技术</p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📦 BufferGeometry 高效渲染</h3>
          <p style={styles.sectionText}>
            BufferGeometry 是 Three.js 中用于存储顶点数据的高性能结构。与 Geometry 不同，
            它直接操作类型化数组（Float32Array），数据存储在 GPU 缓冲区中，渲染数万个顶点也能保持流畅。
          </p>
          <code style={styles.code}>
{`const geometry = new THREE.BufferGeometry()
const positions = new Float32Array(count * 3)
geometry.setAttribute('position', 
  new THREE.BufferAttribute(positions, 3))`}
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>⚡ Points 对象</h3>
          <p style={styles.sectionText}>
            Points 是 Three.js 中用于渲染点精灵的对象。它将 BufferGeometry 中的每个顶点
            渲染为一个单独的点/粒子，配合 PointsMaterial 可控制大小、颜色、透明度等属性。
          </p>
          <ul style={styles.list}>
            <li><strong>Points(geometry, material)</strong>: 创建粒子系统</li>
            <li><strong>粒子数量</strong>: 当前 Demo 使用 8000 个粒子</li>
            <li><strong>分布方式</strong>: 球形空间内均匀随机分布</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎨 属性缓冲区 (Attributes)</h3>
          <p style={styles.sectionText}>
            每个顶点可以拥有多个属性，存储在独立的 BufferAttribute 中。
            这些属性在顶点着色器中可以逐个访问。
          </p>
          <ul style={styles.list}>
            <li><strong>position</strong>: 顶点位置 (x, y, z)</li>
            <li><strong>color</strong>: 顶点颜色 (r, g, b)，配合 vertexColors 使用</li>
            <li><strong>normal</strong>: 法线向量，用于脉动动画方向</li>
            <li>自定义属性可传入 ShaderMaterial 使用</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🔄 动画机制</h3>
          <code style={styles.code}>
{`// 整体缓慢旋转
points.rotation.y += 0.001

// 每个粒子沿法线脉动
pulse = sin(time + offset) * 0.15
newPos = originalPos + normal * pulse`}
          </code>
          <p style={styles.sectionText}>
            关键点：保存原始位置数组，每帧基于原始位置计算新位置，避免累积误差。
            修改后设置 <code style={styles.inlineCode}>needsUpdate = true</code> 通知 GPU 更新。
          </p>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎯 鼠标吸引效果</h3>
          <p style={styles.sectionText}>
            通过 Raycaster 将屏幕鼠标坐标投射到 3D 空间，计算世界坐标。
            遍历粒子，对半径范围内的粒子施加吸引力（距离越近引力越强）。
          </p>
          <code style={styles.code}>
{`const force = (1 - dist / radius) * strength
pos.x += dx * force`}
          </code>
        </section>

        <section style={styles.tipSection}>
          <h4 style={styles.tipTitle}>💡 操作提示</h4>
          <ul style={styles.list}>
            <li>鼠标左键拖拽：旋转视角</li>
            <li>滚轮：缩放视图（观察 sizeAttenuation）</li>
            <li>在画布上移动鼠标：吸引附近粒子</li>
          </ul>
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
    fontFamily: 'system-ui, sans-serif',
  },
  canvas: {
    flex: 1,
    background: '#0a0a1a',
    minWidth: 0,
  },
  panel: {
    width: '400px',
    minWidth: '400px',
    padding: '24px 28px',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0f1a3e 100%)',
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
    margin: '6px 0 24px',
    fontSize: '14px',
    color: '#a080c0',
  },
  section: {
    marginBottom: '20px',
    padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ff6b9d',
  },
  sectionText: {
    margin: '0 0 12px',
    fontSize: '13px',
    lineHeight: 1.7,
    color: '#c0c0d8',
  },
  code: {
    display: 'block',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
    overflowX: 'auto',
    lineHeight: 1.5,
    whiteSpace: 'pre',
  },
  inlineCode: {
    padding: '2px 6px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
  },
  list: {
    margin: '10px 0 0',
    paddingLeft: '18px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#c0c0d8',
  },
  tipSection: {
    marginTop: '24px',
    padding: '14px',
    background: 'rgba(255,107,157,0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(255,107,157,0.25)',
  },
  tipTitle: {
    margin: '0 0 8px 0',
    color: '#ff6b9d',
    fontSize: '14px',
  },
}

export default ParticleSystem
