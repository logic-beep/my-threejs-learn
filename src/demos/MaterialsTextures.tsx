import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type MaterialKey = 'basic' | 'lambert' | 'phong' | 'standard' | 'physical' | 'normal' | 'wireframe'

const createCheckerboardTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const size = 64
  for (let y = 0; y < canvas.height; y += size) {
    for (let x = 0; x < canvas.width; x += size) {
      const isLight = ((x / size) + (y / size)) % 2 === 0
      ctx.fillStyle = isLight ? '#f0f0f0' : '#2d3436'
      ctx.fillRect(x, y, size, size)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

const createGradientTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, '#667eea')
  gradient.addColorStop(0.5, '#764ba2')
  gradient.addColorStop(1, '#f093fb')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 30; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 40 + 10, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`
    ctx.fill()
  }
  return new THREE.CanvasTexture(canvas)
}

const createNoiseTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(256, 256)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = Math.random() * 255
    imageData.data[i] = value
    imageData.data[i + 1] = value
    imageData.data[i + 2] = value
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

const MaterialsTextures = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)
  const controlsRef = useRef<OrbitControls | null>(null)
  const currentMaterialRef = useRef<THREE.Material | null>(null)
  const texturesRef = useRef<{
    checkerboard: THREE.CanvasTexture
    gradient: THREE.CanvasTexture
    noise: THREE.CanvasTexture
  } | null>(null)

  const [currentMaterial, setCurrentMaterial] = useState<MaterialKey>('standard')
  const [currentTexture, setCurrentTexture] = useState<'checkerboard' | 'gradient' | 'noise' | 'none'>('checkerboard')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f1e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 2, 6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35)
    scene.add(ambientLight)

    const pointLight1 = new THREE.PointLight(0xff6b6b, 1.2, 50)
    pointLight1.position.set(-4, 3, 4)
    pointLight1.castShadow = true
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0x4ecdc4, 1, 50)
    pointLight2.position.set(4, 2, 2)
    scene.add(pointLight2)

    const spotLight = new THREE.SpotLight(0xffffff, 1.5)
    spotLight.position.set(0, 8, 4)
    spotLight.angle = Math.PI / 5
    spotLight.penumbra = 0.3
    spotLight.castShadow = true
    scene.add(spotLight)
    scene.add(spotLight.target)
    spotLight.target.position.set(0, 0, 0)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 3
    controls.maxDistance = 20
    controlsRef.current = controls

    const checkerboard = createCheckerboardTexture()
    const gradient = createGradientTexture()
    const noise = createNoiseTexture()
    texturesRef.current = { checkerboard, gradient, noise }

    const geometry = new THREE.SphereGeometry(1.5, 64, 64)
    const initialMaterial = new THREE.MeshStandardMaterial({
      map: checkerboard,
      metalness: 0.3,
      roughness: 0.5,
    })
    const mesh = new THREE.Mesh(geometry, initialMaterial)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    meshRef.current = mesh
    currentMaterialRef.current = initialMaterial

    const groundGeo = new THREE.PlaneGeometry(20, 20)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -2
    ground.receiveShadow = true
    scene.add(ground)

    const sphereGeoSmall1 = new THREE.SphereGeometry(0.15, 16, 16)
    const sphereMat1 = new THREE.MeshBasicMaterial({ color: 0xff6b6b })
    const lightHelper1 = new THREE.Mesh(sphereGeoSmall1, sphereMat1)
    lightHelper1.position.copy(pointLight1.position)
    scene.add(lightHelper1)

    const sphereGeoSmall2 = new THREE.SphereGeometry(0.15, 16, 16)
    const sphereMat2 = new THREE.MeshBasicMaterial({ color: 0x4ecdc4 })
    const lightHelper2 = new THREE.Mesh(sphereGeoSmall2, sphereMat2)
    lightHelper2.position.copy(pointLight2.position)
    scene.add(lightHelper2)

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.005
      }
      const time = Date.now() * 0.001
      pointLight1.position.x = Math.cos(time * 0.7) * 4
      pointLight1.position.z = Math.sin(time * 0.7) * 4
      lightHelper1.position.copy(pointLight1.position)
      pointLight2.position.x = Math.sin(time * 0.5) * 4
      pointLight2.position.z = Math.cos(time * 0.5) * 4
      lightHelper2.position.copy(pointLight2.position)
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
      geometry.dispose()
      initialMaterial.dispose()
      groundGeo.dispose()
      groundMat.dispose()
      checkerboard.dispose()
      gradient.dispose()
      noise.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!meshRef.current || !texturesRef.current) return

    const textures = texturesRef.current
    const mapTexture = currentTexture === 'none' ? null : textures[currentTexture]

    if (currentMaterialRef.current) {
      currentMaterialRef.current.dispose()
    }

    let newMaterial: THREE.Material
    switch (currentMaterial) {
      case 'basic':
        newMaterial = new THREE.MeshBasicMaterial({ map: mapTexture, color: 0xffffff })
        break
      case 'lambert':
        newMaterial = new THREE.MeshLambertMaterial({ map: mapTexture, color: 0xffffff })
        break
      case 'phong':
        newMaterial = new THREE.MeshPhongMaterial({
          map: mapTexture,
          color: 0xffffff,
          shininess: 100,
          specular: 0x444444,
        })
        break
      case 'standard':
        newMaterial = new THREE.MeshStandardMaterial({
          map: mapTexture,
          color: 0xffffff,
          metalness: 0.3,
          roughness: 0.5,
        })
        break
      case 'physical':
        newMaterial = new THREE.MeshPhysicalMaterial({
          map: mapTexture,
          color: 0xffffff,
          metalness: 0.1,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.2,
          reflectivity: 0.5,
        })
        break
      case 'normal':
        newMaterial = new THREE.MeshNormalMaterial({ flatShading: false })
        break
      case 'wireframe':
        newMaterial = new THREE.MeshBasicMaterial({
          color: 0x4ecdc4,
          wireframe: true,
        })
        break
    }

    meshRef.current.material = newMaterial
    currentMaterialRef.current = newMaterial
  }, [currentMaterial, currentTexture])

  const materialButtons: { key: MaterialKey; label: string; color: string }[] = [
    { key: 'basic', label: 'Basic', color: '#ff6b6b' },
    { key: 'lambert', label: 'Lambert', color: '#ffe66d' },
    { key: 'phong', label: 'Phong', color: '#fd79a8' },
    { key: 'standard', label: 'Standard', color: '#4ecdc4' },
    { key: 'physical', label: 'Physical', color: '#a29bfe' },
    { key: 'normal', label: 'Normal', color: '#6c5ce7' },
    { key: 'wireframe', label: 'Wireframe', color: '#00b894' },
  ]

  const textureButtons: { key: 'checkerboard' | 'gradient' | 'noise' | 'none'; label: string }[] = [
    { key: 'checkerboard', label: '棋盘格' },
    { key: 'gradient', label: '渐变' },
    { key: 'noise', label: '噪点' },
    { key: 'none', label: '无纹理' },
  ]

  const materialInfo = [
    {
      name: 'MeshBasicMaterial',
      feature: '基础材质',
      desc: '最简单的材质，不考虑光照影响，物体看起来是平面的。性能最好，但缺乏真实感。',
    },
    {
      name: 'MeshLambertMaterial',
      feature: '朗伯材质',
      desc: '考虑漫反射光照，计算顶点着色。适合无光泽的粗糙表面，性能较好。',
    },
    {
      name: 'MeshPhongMaterial',
      feature: '冯氏材质',
      desc: '在 Lambert 基础上增加了高光（镜面反射）计算。可以表现出有光泽的塑料质感。',
    },
    {
      name: 'MeshStandardMaterial',
      feature: 'PBR标准材质',
      desc: '基于物理的渲染（PBR）材质。通过 metalness 和 roughness 参数模拟真实世界材质。',
    },
    {
      name: 'MeshPhysicalMaterial',
      feature: 'PBR物理材质',
      desc: 'Standard 的扩展，增加了清漆层、透光性、次表面散射等高级物理属性。',
    },
    {
      name: 'MeshNormalMaterial',
      component: '法线材质',
      desc: '将法向量映射为 RGB 颜色。常用于调试法线方向，视觉效果独特。',
    },
    {
      name: 'Wireframe',
      component: '线框模式',
      desc: '只渲染几何体的三角面边线。用于查看网格结构、建模调试或科技感视觉效果。',
    },
  ]

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#0f0f1e' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '16px 24px',
            background: 'rgba(26,26,46,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>切换材质类型：</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {materialButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setCurrentMaterial(btn.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: currentMaterial === btn.key ? `2px solid ${btn.color}` : '2px solid transparent',
                    background: currentMaterial === btn.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: currentMaterial === btn.key ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>切换纹理：</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {textureButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setCurrentTexture(btn.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: currentTexture === btn.key ? '2px solid #4ecdc4' : '2px solid transparent',
                    background: currentTexture === btn.key ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: currentTexture === btn.key ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />
      </div>

      <div style={{
        width: 340,
        padding: 24,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
        overflowY: 'auto',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ marginTop: 0, fontSize: 22, borderBottom: '2px solid #a29bfe', paddingBottom: 12, color: '#a29bfe' }}>
          材质与纹理
        </h2>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: '#4ecdc4', marginBottom: 10 }}>📚 材质区别</h3>
          {materialInfo.map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: 12,
              marginTop: 10,
              borderLeft: '3px solid #a29bfe',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: 14, color: '#fff' }}>{item.name}</strong>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  background: 'rgba(162,155,254,0.2)',
                  color: '#a29bfe',
                  borderRadius: 4,
                }}>{(item as any).feature || (item as any).component}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#bbb', lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: '#ffe66d', marginBottom: 10 }}>🎨 纹理概念</h3>
          <div style={{
            background: 'rgba(255,230,109,0.08)',
            borderRadius: 8,
            padding: 14,
            border: '1px solid rgba(255,230,109,0.2)',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#ccc', lineHeight: 1.7 }}>
              <strong style={{ color: '#ffe66d' }}>纹理（Texture）</strong>是覆盖在几何体表面的图像，可以创造出丰富的细节而无需增加多边形数量。
            </p>
            <div style={{ marginTop: 12, fontSize: 12, color: '#bbb', lineHeight: 1.8 }}>
              <div><strong style={{ color: '#fff' }}>• CanvasTexture：</strong>用 Canvas 动态生成纹理</div>
              <div><strong style={{ color: '#fff' }}>• 重复（Repeat）：</strong>纹理平铺次数</div>
              <div><strong style={{ color: '#fff' }}>• 包裹（Wrap）：</strong>超出范围时的处理方式</div>
              <div><strong style={{ color: '#fff' }}>• UV映射：</strong>2D纹理坐标到3D表面的映射</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 14, background: 'rgba(78,205,196,0.1)', borderRadius: 8, border: '1px solid rgba(78,205,196,0.3)' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#4ecdc4', fontSize: 14 }}>💡 场景说明</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
            <li>红色/青色小球表示动态点光源位置</li>
            <li>聚光灯从上方投射阴影</li>
            <li>环境光提供整体基础亮度</li>
            <li>尝试不同材质对比光照效果差异</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MaterialsTextures
