import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const BasicScene = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const cube = new THREE.Mesh(geometry, material)
    scene.add(cube)

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      cube.rotation.x += 0.01
      cube.rotation.y += 0.01
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
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
        <h2 style={styles.title}>基础 Three.js 场景</h2>
        <p style={styles.subtitle}>三大核心概念</p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎬 Scene（场景）</h3>
          <p style={styles.sectionText}>
            场景是所有 3D 对象的容器，相当于一个舞台。所有的物体、灯光、相机都需要添加到场景中才能被渲染。
          </p>
          <code style={styles.code}>
            const scene = new THREE.Scene()
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📷 Camera（相机）</h3>
          <p style={styles.sectionText}>
            相机决定了我们从哪个角度、以怎样的视野去观察场景。PerspectiveCamera 是透视相机，模拟人眼看到的近大远小效果。
          </p>
          <code style={styles.code}>
            const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
          </code>
          <ul style={styles.list}>
            <li><strong>fov</strong>: 视野角度（75°）</li>
            <li><strong>aspect</strong>: 宽高比</li>
            <li><strong>near/far</strong>: 近/远裁剪面</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🖼️ Renderer（渲染器）</h3>
          <p style={styles.sectionText}>
            渲染器负责将场景和相机结合起来，通过 WebGL 把 3D 场景绘制到 canvas 画布上，最终显示在浏览器中。
          </p>
          <code style={styles.code}>
            renderer.render(scene, camera)
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🧊 立方体组成</h3>
          <ul style={styles.list}>
            <li><strong>BoxGeometry</strong>: 定义立方体的形状（顶点）</li>
            <li><strong>MeshBasicMaterial</strong>: 定义材质外观（绿色）</li>
            <li><strong>Mesh</strong>: 几何体 + 材质 = 可渲染的物体</li>
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
    background: '#1a1a2e',
    minWidth: 0,
  },
  panel: {
    width: '380px',
    minWidth: '380px',
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
    margin: '6px 0 24px',
    fontSize: '14px',
    color: '#a0a0c0',
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#00ff88',
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
  },
  list: {
    margin: '10px 0 0',
    paddingLeft: '18px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#c0c0d8',
  },
}

export default BasicScene
