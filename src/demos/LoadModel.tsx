import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// 实际项目中取消注释以下导入：
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const LoadModel = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)
  const robotGroupRef = useRef<THREE.Group | null>(null)
  const leftArmRef = useRef<THREE.Mesh | null>(null)
  const rightArmRef = useRef<THREE.Mesh | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())

  const [loadingProgress, setLoadingProgress] = useState<number>(100)
  const [loadingText, setLoadingText] = useState<string>('模型已就绪（程序化生成）')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    scene.fog = new THREE.Fog(0x1a1a2e, 20, 60)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 4, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(8, 12, 6)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -15
    directionalLight.shadow.camera.right = 15
    directionalLight.shadow.camera.top = 15
    directionalLight.shadow.camera.bottom = -15
    scene.add(directionalLight)

    const pointLight = new THREE.PointLight(0x00aaff, 0.8, 30)
    pointLight.position.set(-6, 4, -4)
    scene.add(pointLight)

    const pointLight2 = new THREE.PointLight(0xff6b6b, 0.6, 25)
    pointLight2.position.set(6, 3, 4)
    scene.add(pointLight2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 5
    controls.maxDistance = 35
    controls.target.set(0, 2, 0)

    const createRobot = (): THREE.Group => {
      const robot = new THREE.Group()

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4ecdc4, metalness: 0.4, roughness: 0.5 })
      const accentMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.6, roughness: 0.3 })
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffe66d, metalness: 0.3, roughness: 0.4 })
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.1, roughness: 0.8 })
      const eyeGlowMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 })

      const bodyGeo = new THREE.BoxGeometry(2.2, 2.8, 1.4)
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 1.4
      body.castShadow = true
      body.receiveShadow = true
      robot.add(body)

      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.2), accentMat)
      chestPlate.position.set(0, 1.8, 0.72)
      chestPlate.castShadow = true
      robot.add(chestPlate)

      const headGeo = new THREE.BoxGeometry(1.4, 1.2, 1.2)
      const head = new THREE.Mesh(headGeo, headMat)
      head.position.y = 3.6
      head.castShadow = true
      robot.add(head)

      const antennaGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8)
      const antenna = new THREE.Mesh(antennaGeo, accentMat)
      antenna.position.set(0, 4.45, 0)
      robot.add(antenna)

      const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), accentMat)
      antennaBall.position.set(0, 4.8, 0)
      robot.add(antennaBall)

      const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16)
      const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat)
      leftEye.position.set(-0.35, 3.7, 0.58)
      robot.add(leftEye)

      const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat)
      rightEye.position.set(0.35, 3.7, 0.58)
      robot.add(rightEye)

      const mouthGeo = new THREE.BoxGeometry(0.6, 0.12, 0.08)
      const mouth = new THREE.Mesh(mouthGeo, eyeMat)
      mouth.position.set(0, 3.2, 0.6)
      robot.add(mouth)

      const neckGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 16)
      const neck = new THREE.Mesh(neckGeo, accentMat)
      neck.position.y = 2.85
      neck.castShadow = true
      robot.add(neck)

      const shoulderGeo = new THREE.SphereGeometry(0.45, 16, 16)
      const leftShoulder = new THREE.Mesh(shoulderGeo, accentMat)
      leftShoulder.position.set(-1.5, 2.6, 0)
      leftShoulder.castShadow = true
      robot.add(leftShoulder)

      const rightShoulder = new THREE.Mesh(shoulderGeo, accentMat)
      rightShoulder.position.set(1.5, 2.6, 0)
      rightShoulder.castShadow = true
      robot.add(rightShoulder)

      const upperArmGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5)
      const leftArm = new THREE.Mesh(upperArmGeo, bodyMat)
      leftArm.position.set(-1.5, 1.5, 0)
      leftArm.castShadow = true
      robot.add(leftArm)
      leftArmRef.current = leftArm

      const rightArm = new THREE.Mesh(upperArmGeo, bodyMat)
      rightArm.position.set(1.5, 1.5, 0)
      rightArm.castShadow = true
      robot.add(rightArm)
      rightArmRef.current = rightArm

      const forearmGeo = new THREE.BoxGeometry(0.45, 1.3, 0.45)
      const leftForearm = new THREE.Mesh(forearmGeo, headMat)
      leftForearm.position.set(-1.5, 0.15, 0)
      leftForearm.castShadow = true
      robot.add(leftForearm)

      const rightForearm = new THREE.Mesh(forearmGeo, headMat)
      rightForearm.position.set(1.5, 0.15, 0)
      rightForearm.castShadow = true
      robot.add(rightForearm)

      const handGeo = new THREE.SphereGeometry(0.32, 16, 16)
      const leftHand = new THREE.Mesh(handGeo, accentMat)
      leftHand.position.set(-1.5, -0.6, 0)
      leftHand.castShadow = true
      robot.add(leftHand)

      const rightHand = new THREE.Mesh(handGeo, accentMat)
      rightHand.position.set(1.5, -0.6, 0)
      rightHand.castShadow = true
      robot.add(rightHand)

      const hipGeo = new THREE.BoxGeometry(1.8, 0.5, 1.1)
      const hip = new THREE.Mesh(hipGeo, accentMat)
      hip.position.y = -0.25
      hip.castShadow = true
      robot.add(hip)

      const legGeo = new THREE.BoxGeometry(0.6, 1.6, 0.6)
      const leftLeg = new THREE.Mesh(legGeo, bodyMat)
      leftLeg.position.set(-0.55, -1.3, 0)
      leftLeg.castShadow = true
      robot.add(leftLeg)

      const rightLeg = new THREE.Mesh(legGeo, bodyMat)
      rightLeg.position.set(0.55, -1.3, 0)
      rightLeg.castShadow = true
      robot.add(rightLeg)

      const footGeo = new THREE.BoxGeometry(0.75, 0.3, 1.1)
      const leftFoot = new THREE.Mesh(footGeo, accentMat)
      leftFoot.position.set(-0.55, -2.25, 0.15)
      leftFoot.castShadow = true
      robot.add(leftFoot)

      const rightFoot = new THREE.Mesh(footGeo, accentMat)
      rightFoot.position.set(0.55, -2.25, 0.15)
      rightFoot.castShadow = true
      robot.add(rightFoot)

      robot.position.set(-4, 0, 0)
      return robot
    }

    const createExtrudedModel = (): THREE.Group => {
      const group = new THREE.Group()

      const houseShape = new THREE.Shape()
      houseShape.moveTo(-2, 0)
      houseShape.lineTo(-2, 2)
      houseShape.lineTo(-1.4, 2.8)
      houseShape.lineTo(0, 3.6)
      houseShape.lineTo(1.4, 2.8)
      houseShape.lineTo(2, 2)
      houseShape.lineTo(2, 0)
      houseShape.lineTo(-2, 0)

      const hole1 = new THREE.Path()
      hole1.moveTo(-0.6, 0)
      hole1.lineTo(-0.6, 1.2)
      hole1.lineTo(0.6, 1.2)
      hole1.lineTo(0.6, 0)
      hole1.lineTo(-0.6, 0)
      houseShape.holes.push(hole1)

      const hole2 = new THREE.Path()
      hole2.absarc(-1.2, 1.4, 0.35, 0, Math.PI * 2, true)
      houseShape.holes.push(hole2)

      const hole3 = new THREE.Path()
      hole3.absarc(1.2, 1.4, 0.35, 0, Math.PI * 2, true)
      houseShape.holes.push(hole3)

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: 2,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.1,
        bevelSegments: 4,
      }

      const houseGeo = new THREE.ExtrudeGeometry(houseShape, extrudeSettings)
      houseGeo.center()

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xa29bfe,
        metalness: 0.2,
        roughness: 0.7,
      })
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xfd79a8,
        metalness: 0.3,
        roughness: 0.6,
      })

      const materials = [wallMat, roofMat]

      const house = new THREE.Mesh(houseGeo, materials)
      house.castShadow = true
      house.receiveShadow = true
      house.rotation.y = Math.PI / 2
      group.add(house)

      const starShape = new THREE.Shape()
      const outerRadius = 0.7
      const innerRadius = 0.3
      const points = 5
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        if (i === 0) starShape.moveTo(x, y)
        else starShape.lineTo(x, y)
      }
      starShape.closePath()

      const starGeo = new THREE.ExtrudeGeometry(starShape, {
        depth: 0.4,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.05,
        bevelSegments: 2,
      })
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xffe66d,
        emissive: 0xffe66d,
        emissiveIntensity: 0.15,
        metalness: 0.5,
        roughness: 0.4,
      })
      const star = new THREE.Mesh(starGeo, starMat)
      star.castShadow = true
      star.position.set(0, 2.8, 0)
      group.add(star)

      group.position.set(4, 0, 0)
      return group
    }

    const simulateLoading = () => {
      setLoadingProgress(0)
      setLoadingText('正在初始化加载管理器...')

      const _loadingManager = new THREE.LoadingManager(
        () => {
          setLoadingText('所有资源加载完成！')
        },
        (_url, itemsLoaded, itemsTotal) => {
          const progress = Math.round((itemsLoaded / itemsTotal) * 100)
          setLoadingProgress(progress)
          setLoadingText(`正在加载: ${progress}% (${itemsLoaded}/${itemsTotal})`)
        },
        (url) => {
          setLoadingText(`加载出错: ${url}`)
        }
      )
      void _loadingManager

      /*
       * ============================================
       * GLTFLoader 使用框架 - 完整代码结构参考
       * ============================================
       *
       * GLTF (GL Transmission Format) 是 Khronos 组织推出的 3D 资产标准格式
       * 被称为 "3D 界的 JPEG"，是 Three.js 官方推荐的模型格式
       *
       * GLTF 有两种变体：
       *   - .gltf: JSON + 外部贴图/二进制文件（便于调试）
       *   - .glb: 单个二进制文件（体积小、加载快、推荐生产环境使用）
       *
       * 实际项目中，替换下面的注释代码即可加载真实模型
       */

      // import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
      //
      // const gltfLoader = new GLTFLoader(loadingManager)
      //
      // // 基础用法
      // gltfLoader.load(
      //   '/models/your-model.glb',
      //   (gltf) => {
      //     // 加载成功回调
      //     const model = gltf.scene          // 模型根节点 (Group 或 Object3D)
      //     const animations = gltf.animations // 动画剪辑数组
      //
      //     // 遍历模型设置阴影和材质
      //     model.traverse((child) => {
      //       if (child instanceof THREE.Mesh) {
      //         child.castShadow = true
      //         child.receiveShadow = true
      //         // 如果模型材质太暗，可调整：
      //         if (child.material instanceof THREE.MeshStandardMaterial) {
      //           child.material.envMapIntensity = 1.0
      //         }
      //       }
      //     })
      //
      //     // 如果有动画，需要用 AnimationMixer 播放
      //     if (animations && animations.length > 0) {
      //       const mixer = new THREE.AnimationMixer(model)
      //       const action = mixer.clipAction(animations[0])
      //       action.play()
      //       // 渲染循环中需要调用: mixer.update(deltaTime)
      //     }
      //
      //     scene.add(model)
      //   },
      //   (progress) => {
      //     // 进度回调（部分浏览器可能不支持精确进度）
       //     if (progress.total > 0) {
      //       const pct = (progress.loaded / progress.total) * 100
      //       console.log(`模型加载进度: ${pct.toFixed(1)}%`)
      //     }
      //   },
      //   (error) => {
      //     // 错误回调
      //     console.error('GLTF 模型加载失败:', error)
      //   }
      // )
      //
      // /* ============ Promise 封装版本（推荐，便于 async/await） ============ */
      // const loadGLTF = (url: string): Promise<THREE.GLTF> => {
      //   return new Promise((resolve, reject) => {
      //     gltfLoader.load(url, resolve, undefined, reject)
      //   })
      // }
      //
      // // 使用:
      // async function init() {
      //   try {
      //     const gltf = await loadGLTF('/models/scene.glb')
      //     scene.add(gltf.scene)
      //   } catch (e) {
      //     console.error(e)
      //   }
      // }
      //
      /*
       * ============================================
       * Draco 压缩模型说明
       * ============================================
       *
       * Draco 是 Google 开发的开源压缩库，专门针对 3D 几何数据（顶点、法线、UV等）
       * 可以大幅减小模型文件体积（通常压缩 60%~90%），显著减少网络传输时间
       *
       * 使用方法（需要额外引入 DRACOLoader）：
       *
       * import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
       *
       * const dracoLoader = new DRACOLoader()
       * // Draco 解码器 wasm 文件路径，three.js 官方 CDN:
       * // https://www.gstatic.com/draco/versioned/decoders/1.5.6/
       * dracoLoader.setDecoderPath('/draco/')
       * dracoLoader.setDecoderConfig({ type: 'wasm' })
       *
       * const gltfLoader = new GLTFLoader()
       * gltfLoader.setDRACOLoader(dracoLoader)  // 关联 Draco 解码器
       *
       * gltfLoader.load('/models/draco-compressed.glb', (gltf) => {
       *   scene.add(gltf.scene)
       * })
       *
       * 注意事项：
       * 1. 解码有 CPU 开销，建议只对复杂模型使用 Draco 压缩
       * 2. 简单几何体（如本 Demo 的程序化模型）使用 Draco 反而会增加整体体积
       * 3. Blender 导出 GLB 时可直接勾选 "压缩 (Draco)" 选项
       */

      /*
       * ============================================
       * LoadingManager 说明
       * ============================================
       *
       * THREE.LoadingManager 用于统一管理多个 Loader 的加载状态
       * 它可以追踪所有关联的 loader 进度，提供统一的回调：
       *   - onStart: 开始加载（可选）
       *   - onLoad: 全部加载完成
       *   - onProgress: 每项资源加载完成时触发
       *   - onError: 任意资源加载失败
       *
       * 所有内建 Loader (GLTFLoader, TextureLoader, FontLoader 等)
       * 都支持在构造函数中传入 LoadingManager 实例来共享加载进度
       *
       * 高级用法：
       *   loadingManager.setURLModifier((url) => {
       *     // URL 重写，比如加 CDN 前缀或版本号
       *     return 'https://cdn.example.com/' + url + '?v=1.0'
       *   })
       */

      let progress = 0
      const timer = setInterval(() => {
        progress += 3
        if (progress >= 100) {
          progress = 100
          setLoadingProgress(100)
          setLoadingText('程序化工序模型加载完成！')
          clearInterval(timer)
        } else {
          setLoadingProgress(progress)
          setLoadingText(`正在模拟 GLB 模型解析: ${progress}%`)
        }
      }, 60)
    }

    simulateLoading()

    const robot = createRobot()
    robotGroupRef.current = robot
    scene.add(robot)

    const extrudedHouse = createExtrudedModel()
    scene.add(extrudedHouse)

    const groundGeo = new THREE.PlaneGeometry(80, 80)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f3460,
      metalness: 0.1,
      roughness: 0.95,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -2.5
    ground.receiveShadow = true
    scene.add(ground)

    const gridHelper = new THREE.GridHelper(40, 40, 0x165dba, 0x0d2a4a)
    gridHelper.position.y = -2.49
    scene.add(gridHelper)

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)

      const elapsed = clockRef.current.getElapsedTime()

      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(elapsed * 2) * 0.6 - 0.2
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = Math.sin(elapsed * 2 + Math.PI) * 0.6 - 0.2
      }

      if (robotGroupRef.current) {
        robotGroupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.1
      }

      extrudedHouse.rotation.y += 0.004

      pointLight.position.x = Math.cos(elapsed) * 6
      pointLight.position.z = Math.sin(elapsed) * 6

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

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose()
          const mat = obj.material
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose())
          } else if (mat) {
            mat.dispose()
          }
        }
      })

      groundGeo.dispose()
      groundMat.dispose()
      renderer.dispose()

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas}>
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingCard}>
            <div style={styles.loadingText}>{loadingText}</div>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${loadingProgress}%`,
                  opacity: loadingProgress >= 100 ? 0.6 : 1,
                }}
              />
            </div>
            <div style={styles.progressNum}>{loadingProgress}%</div>
          </div>
        </div>
      </div>

      <aside style={styles.panel}>
        <h2 style={styles.title}>3D 模型加载</h2>
        <p style={styles.subtitle}>
          GLTF/GLB · Loader 体系 · LoadingManager · Group 组合
        </p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📦 GLTF / GLB 格式优势</h3>
          <ul style={styles.list}>
            <li><strong>官方推荐</strong>: Three.js 首选格式，持续维护更新</li>
            <li><strong>传输高效</strong>: 基于 JSON/二进制，体积小、解析快</li>
            <li><strong>功能完备</strong>: 支持网格、材质、纹理、骨骼动画、蒙皮、变形目标</li>
            <li><strong>两种形态</strong>: .gltf（JSON+外部资源，调试友好） vs .glb（单二进制，生产推荐）</li>
            <li><strong>PBR 材质</strong>: 原生支持基于物理的渲染，效果逼真</li>
            <li><strong>生态广泛</strong>: Blender、Maya、3ds Max、Unity 等均支持导出</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🔌 Loader 加载器体系</h3>
          <p style={styles.sectionText}>
            Three.js 将不同格式的解析逻辑封装为独立的 Loader，统一在
            <code style={styles.inlineCode}> three/examples/jsm/loaders/ </code>
            目录下。
          </p>
          <ul style={styles.list}>
            <li><strong>GLTFLoader</strong>: 加载 .gltf / .glb 格式（⭐ 首选）</li>
            <li><strong>OBJLoader</strong>: 加载 .obj 格式（传统格式，不包含材质）</li>
            <li><strong>FBXLoader</strong>: 加载 .fbx 格式（3ds Max / Maya 常用）</li>
            <li><strong>TextureLoader</strong>: 加载图片纹理为 THREE.Texture</li>
            <li><strong>CubeTextureLoader</strong>: 加载 6 面立方体贴图（天空盒）</li>
            <li><strong>FontLoader</strong>: 加载字体 JSON，用于 TextGeometry</li>
            <li><strong>DRACOLoader</strong>: Draco 几何压缩解码器（配合 GLTFLoader）</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎯 Group 组合对象</h3>
          <p style={styles.sectionText}>
            THREE.Group 是 Object3D 的子类，本身不渲染任何几何体，
            用来将多个 Mesh 组成逻辑整体，像"文件文件夹"一样组织场景树。
          </p>
          <ul style={styles.list}>
            <li><strong>层级变换</strong>: 移动/旋转/缩放 Group，所有子物体同步变换</li>
            <li><strong>局部坐标系</strong>: 子物体 position 相对父 Group 计算</li>
            <li><strong>遍历操作</strong>: <code style={styles.inlineCode}>group.traverse(fn)</code> 递归访问所有后代</li>
            <li><strong>命名查找</strong>: <code style={styles.inlineCode}>group.getObjectByName(name)</code></li>
            <li><strong>可见性控制</strong>: 设置 group.visible = false 隐藏整组</li>
            <li><strong>典型场景</strong>: 机器人（头/身/四肢）、房屋（墙/屋顶/门窗）</li>
          </ul>
          <p style={styles.highlight}>
            💡 本 Demo 左侧机器人由 20+ 个 Mesh 组合在一个 Group 中，
            可作为整体平移/旋转；同时单独引用手臂 Mesh 实现独立摆动动画。
          </p>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📊 LoadingManager 统一进度</h3>
          <p style={styles.sectionText}>
            当场景需要加载多个资源（模型 + 贴图 + HDR 环境图等）时，
            LoadingManager 统一跟踪进度，避免每个 Loader 单独写回调。
          </p>
          <code style={styles.code}>
{`const manager = new THREE.LoadingManager(
  () => console.log('全部加载完成'),
  (url, loaded, total) =>
    console.log(\`\${loaded}/\${total}\`),
  (url) => console.error('错误:', url)
)

// 将 manager 传入各个 Loader
const gltfLoader = new GLTFLoader(manager)
const texLoader = new THREE.TextureLoader(manager)`}
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🧹 资源管理 (dispose)</h3>
          <p style={styles.sectionText}>
            切换路由、卸载组件时必须手动释放 GPU 资源！Three.js 不会自动回收
            BufferGeometry、Material、Texture，否则会造成严重内存泄漏。
          </p>
          <code style={styles.code}>
{`// 遍历场景树 dispose 所有资源
scene.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    obj.geometry?.dispose()
    const mat = obj.material
    if (Array.isArray(mat)) {
      mat.forEach(m => m.dispose())
    } else {
      mat?.dispose()
    }
  }
})

renderer.dispose()       // 释放 WebGL 上下文
controls?.dispose()      // 轨道控制器解绑事件`}
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🏗️ 本 Demo 程序化模型</h3>
          <ul style={styles.list}>
            <li><strong>左侧机器人</strong>: 纯 Group + Box/Sphere 组合，手臂手动动画</li>
            <li><strong>右侧小房子</strong>: Shape 定义 2D 轮廓（含窗户/门洞镂空），ExtrudeGeometry 挤出为 3D</li>
            <li><strong>Loading UI</strong>: 左上角 LoadingManager 模拟进度百分比</li>
          </ul>
        </section>

        <div style={styles.tipBox}>
          <h4 style={styles.tipTitle}>🎮 操作提示</h4>
          <ul style={styles.tipList}>
            <li>左键拖拽：旋转视角</li>
            <li>右键拖拽：平移场景</li>
            <li>滚轮：缩放距离</li>
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
  canvas: {
    flex: 1,
    background: '#1a1a2e',
    minWidth: 0,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    pointerEvents: 'none',
  },
  loadingCard: {
    background: 'rgba(15, 52, 96, 0.92)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 136, 0.3)',
    borderRadius: 12,
    padding: '16px 20px',
    minWidth: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  loadingText: {
    fontSize: 13,
    color: '#a0ffd0',
    marginBottom: 10,
    fontWeight: 500,
  },
  progressBar: {
    width: '100%',
    height: 8,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00ff88, #00aaff)',
    borderRadius: 4,
    transition: 'width 0.2s ease, opacity 0.5s ease',
  },
  progressNum: {
    fontSize: 11,
    color: '#80c0a0',
    textAlign: 'right',
    fontFamily: 'ui-monospace, Consolas, monospace',
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
    margin: '6px 0 24px',
    fontSize: '13px',
    color: '#a0a0c0',
    letterSpacing: '0.3px',
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
    fontSize: '15px',
    fontWeight: 600,
    color: '#00ff88',
  },
  sectionText: {
    margin: '0 0 10px',
    fontSize: '12.5px',
    lineHeight: 1.75,
    color: '#c0c0d8',
  },
  list: {
    margin: '8px 0 0',
    paddingLeft: '18px',
    fontSize: '12.5px',
    lineHeight: 1.85,
    color: '#c0c0d8',
  },
  inlineCode: {
    display: 'inline-block',
    padding: '1px 6px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
    fontSize: '11.5px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
    margin: '0 2px',
  },
  code: {
    display: 'block',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '6px',
    fontSize: '11px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0b0ff',
    overflowX: 'auto',
    lineHeight: 1.6,
    whiteSpace: 'pre',
  },
  highlight: {
    marginTop: 12,
    padding: '10px 12px',
    background: 'rgba(0, 255, 136, 0.08)',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    borderRadius: 6,
    fontSize: '12px',
    lineHeight: 1.6,
    color: '#a0ffc8',
  },
  tipBox: {
    marginTop: 24,
    padding: 14,
    background: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 8,
    border: '1px solid rgba(78, 205, 196, 0.3)',
  },
  tipTitle: {
    margin: '0 0 8px 0',
    color: '#4ecdc4',
    fontSize: 14,
  },
  tipList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 12.5,
    lineHeight: 1.85,
    color: '#ccc',
  },
}

export default LoadModel
