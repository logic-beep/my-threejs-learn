import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const Geometries = () => {
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
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 5, 12)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 10, 7)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 5
    controls.maxDistance = 30

    const geometryConfigs = [
      { name: 'Box', geometry: new THREE.BoxGeometry(1.5, 1.5, 1.5), color: 0xff6b6b },
      { name: 'Sphere', geometry: new THREE.SphereGeometry(1, 32, 32), color: 0x4ecdc4 },
      { name: 'Torus', geometry: new THREE.TorusGeometry(0.9, 0.3, 16, 100), color: 0xffe66d },
      { name: 'Cylinder', geometry: new THREE.CylinderGeometry(0.8, 0.8, 1.6, 32), color: 0xa29bfe },
      { name: 'Cone', geometry: new THREE.ConeGeometry(0.9, 1.6, 32), color: 0xfd79a8 },
      { name: 'Plane', geometry: new THREE.PlaneGeometry(1.8, 1.8), color: 0x6c5ce7 },
      { name: 'TorusKnot', geometry: new THREE.TorusKnotGeometry(0.7, 0.25, 100, 16), color: 0x00b894 },
    ]

    const group = new THREE.Group()
    scene.add(group)

    const cols = 4
    const spacing = 3
    const startX = -((cols - 1) * spacing) / 2
    const startZ = -1.5

    geometryConfigs.forEach((config, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: config.color,
        metalness: 0.3,
        roughness: 0.5,
      })
      const mesh = new THREE.Mesh(config.geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true

      const col = index % cols
      const row = Math.floor(index / cols)
      mesh.position.set(
        startX + col * spacing,
        0,
        startZ + row * spacing
      )

      group.add(mesh)
    })

    const planeGeometry = new THREE.PlaneGeometry(30, 30)
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      metalness: 0.1,
      roughness: 0.9,
    })
    const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial)
    groundPlane.rotation.x = -Math.PI / 2
    groundPlane.position.y = -2
    groundPlane.receiveShadow = true
    scene.add(groundPlane)

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      group.rotation.y += 0.003
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
      geometryConfigs.forEach(c => c.geometry.dispose())
      planeGeometry.dispose()
      planeMaterial.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  const geometryList = [
    { name: 'BoxGeometry', desc: '立方体/长方体，最基础的几何体，由6个矩形面组成。常用于建筑、箱子等规则物体。' },
    { name: 'SphereGeometry', desc: '球体，通过经纬度分段生成。分段数越高越平滑，性能开销也越大。' },
    { name: 'TorusGeometry', desc: '圆环体，类似甜甜圈的形状。可用于轮胎、指环等环形物体。' },
    { name: 'CylinderGeometry', desc: '圆柱体，可通过设置上下半径不同来创建圆台或棱锥。' },
    { name: 'ConeGeometry', desc: '圆锥体，底面为圆形，顶部汇聚为一点。常用于冰淇淋甜筒、路标等。' },
    { name: 'PlaneGeometry', desc: '平面几何体，只有一个面（默认显示正面）。常用于地面、墙壁、屏幕等。' },
    { name: 'TorusKnotGeometry', desc: '环形结，一种复杂的参数化几何体。视觉效果独特，适合做装饰。' },
  ]

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#0f0f1e' }}>
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />

      <div style={{
        width: 320,
        padding: 24,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
        overflowY: 'auto',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ marginTop: 0, fontSize: 22, borderBottom: '2px solid #4ecdc4', paddingBottom: 12, color: '#4ecdc4' }}>
          常用几何体类型
        </h2>
        <p style={{ color: '#aaa', lineHeight: 1.6, fontSize: 14 }}>
          Three.js 提供了丰富的基础几何体构造函数，通过组合它们可以创建复杂的3D场景。
        </p>

        {geometryList.map((item, index) => (
          <div key={index} style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            padding: 14,
            marginTop: 14,
            borderLeft: `3px solid ${['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8', '#6c5ce7', '#00b894'][index]}`,
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#fff' }}>
              {item.name}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>
              {item.desc}
            </p>
          </div>
        ))}

        <div style={{ marginTop: 24, padding: 14, background: 'rgba(78,205,196,0.1)', borderRadius: 8, border: '1px solid rgba(78,205,196,0.3)' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#4ecdc4', fontSize: 14 }}>💡 操作提示</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#ccc', lineHeight: 1.8 }}>
            <li>鼠标左键拖拽：旋转视角</li>
            <li>鼠标右键拖拽：平移场景</li>
            <li>滚轮：缩放视图</li>
            <li>场景整体缓慢旋转中</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Geometries
