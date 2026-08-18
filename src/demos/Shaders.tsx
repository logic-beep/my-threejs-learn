import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type ShaderPreset = 'wave' | 'rainbow' | 'noise' | 'stripes'

const vertexShaders: Record<ShaderPreset, string> = {
  wave: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float elevation = sin(pos.x * 3.0 + uTime * 2.0) * 0.3;
      elevation += sin(pos.y * 2.5 + uTime * 1.5) * 0.2;
      elevation += sin((pos.x + pos.y) * 2.0 + uTime) * 0.15;
      pos.z += elevation;
      vElevation = elevation;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  rainbow: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  noise: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vNoise;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      float noise = snoise(vec3(pos.xy * 2.0, uTime * 0.5));
      float noise2 = snoise(vec3(pos.xy * 4.0 + 100.0, uTime * 0.3));
      vNoise = noise * 0.7 + noise2 * 0.3;
      pos.z += vNoise * 0.8;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  stripes: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float stripe = sin(pos.x * 8.0 + uTime * 3.0) * 0.1;
      stripe *= sin(pos.y * 6.0 + uTime * 2.0);
      pos.z += stripe;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
}

const fragmentShaders: Record<ShaderPreset, string> = {
  wave: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float t = vElevation * 2.0 + 0.5;
      vec3 color1 = vec3(0.1, 0.4, 0.8);
      vec3 color2 = vec3(0.8, 0.2, 0.6);
      vec3 color3 = vec3(0.2, 0.9, 0.7);
      vec3 color = mix(color1, color2, smoothstep(-0.3, 0.3, vElevation));
      color = mix(color, color3, smoothstep(0.2, 0.6, vElevation));
      color += 0.1 * sin(vUv.y * 20.0 + uTime);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  rainbow: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      float hue = vUv.x + vUv.y * 0.5 + uTime * 0.1;
      vec3 color = hsv2rgb(vec3(hue, 0.8, 0.9));
      float glow = sin(vUv.y * 10.0 + uTime * 2.0) * 0.1 + 0.9;
      color *= glow;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  noise: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vNoise;

    void main() {
      float n = vNoise * 0.5 + 0.5;
      vec3 cool = vec3(0.05, 0.1, 0.3);
      vec3 warm = vec3(0.9, 0.5, 0.1);
      vec3 hot = vec3(1.0, 0.9, 0.3);
      vec3 color = mix(cool, warm, smoothstep(0.2, 0.5, n));
      color = mix(color, hot, smoothstep(0.6, 0.9, n));
      float bands = sin(n * 15.0 + uTime) * 0.1;
      color += bands;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  stripes: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      float angle = vUv.x * 12.0 + uTime * 2.0;
      float stripe = smoothstep(0.4, 0.5, fract(angle));
      stripe *= smoothstep(0.6, 0.5, fract(angle));
      float angle2 = vUv.y * 10.0 - uTime * 1.5 + vUv.x * 3.0;
      float stripe2 = smoothstep(0.45, 0.5, fract(angle2));
      stripe2 *= smoothstep(0.55, 0.5, fract(angle2));
      vec3 c1 = vec3(0.0, 0.7, 0.9);
      vec3 c2 = vec3(0.9, 0.1, 0.5);
      vec3 c3 = vec3(1.0, 0.9, 0.2);
      vec3 color = mix(c1, c2, stripe);
      color = mix(color, c3, stripe2 * 0.8);
      color += 0.05 * sin(vUv.x * 50.0 + uTime);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

const Shaders = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number>(0)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)
  const [currentPreset, setCurrentPreset] = useState<ShaderPreset>('wave')

  const presets: { key: ShaderPreset; name: string; desc: string; icon: string }[] = [
    { key: 'wave', name: '波浪起伏', desc: '多频率正弦波叠加的地形变形', icon: '🌊' },
    { key: 'rainbow', name: '彩虹渐变', desc: 'HSV 色彩空间动态流动', icon: '🌈' },
    { key: 'noise', name: '噪声地形', desc: 'Simplex Noise 程序化起伏', icon: '🔥' },
    { key: 'stripes', name: '条纹图案', desc: '动态交错的几何条纹', icon: '📊' },
  ]

  const updateShader = useCallback((preset: ShaderPreset) => {
    if (!materialRef.current) return
    materialRef.current.vertexShader = vertexShaders[preset]
    materialRef.current.fragmentShader = fragmentShaders[preset]
    materialRef.current.needsUpdate = true
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a1a)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 0, 6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 3
    controls.maxDistance = 15

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    const geometry = new THREE.PlaneGeometry(5, 5, 128, 128)

    const uniforms = {
      uTime: { value: 0 },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShaders.wave,
      fragmentShader: fragmentShaders.wave,
      uniforms,
      side: THREE.DoubleSide,
      wireframe: false,
    })
    materialRef.current = material

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 3
    scene.add(mesh)
    meshRef.current = mesh

    const clock = new THREE.Clock()
    clockRef.current = clock

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = elapsed
      }
      if (meshRef.current) {
        meshRef.current.rotation.z = Math.sin(elapsed * 0.1) * 0.1
      }
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
      material.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    updateShader(currentPreset)
  }, [currentPreset, updateShader])

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas} />
      <aside style={styles.panel}>
        <h2 style={styles.title}>🎨 自定义着色器 Shaders</h2>
        <p style={styles.subtitle}>WebGL 渲染管线与 GLSL 编程</p>

        <section style={styles.presetSection}>
          <h3 style={styles.sectionTitle}>🔀 切换效果预设</h3>
          <div style={styles.presetGrid}>
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setCurrentPreset(p.key)}
                style={{
                  ...styles.presetBtn,
                  ...(currentPreset === p.key ? styles.presetBtnActive : {}),
                }}
              >
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{p.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🔗 WebGL 渲染管线</h3>
          <p style={styles.sectionText}>
            WebGL 基于 OpenGL ES，将 3D 数据渲染为 2D 像素需要经过一系列固定和可编程阶段：
          </p>
          <div style={styles.pipeline}>
            <div style={styles.pipeItem}><span style={styles.pipeNum}>1</span>顶点数据 (Attributes)</div>
            <div style={styles.pipeArrow}>→</div>
            <div style={{ ...styles.pipeItem, background: 'rgba(0,200,150,0.15)', borderColor: '#00c896' }}>
              <span style={styles.pipeNum}>2</span><strong>Vertex Shader</strong> ⭐
            </div>
            <div style={styles.pipeArrow}>→</div>
            <div style={styles.pipeItem}><span style={styles.pipeNum}>3</span>图元装配 & 光栅化</div>
            <div style={styles.pipeArrow}>→</div>
            <div style={{ ...styles.pipeItem, background: 'rgba(255,150,50,0.15)', borderColor: '#ff9632' }}>
              <span style={styles.pipeNum}>4</span><strong>Fragment Shader</strong> ⭐
            </div>
            <div style={styles.pipeArrow}>→</div>
            <div style={styles.pipeItem}><span style={styles.pipeNum}>5</span>帧缓冲输出</div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>👤 Vertex Shader 顶点着色器</h3>
          <p style={styles.sectionText}>
            <strong>逐顶点执行</strong>，处理每个顶点的位置变换。可以修改顶点位置实现形变动画。
          </p>
          <ul style={styles.list}>
            <li><strong>输入</strong>: position, uv, normal 等 attributes</li>
            <li><strong>输出</strong>: gl_Position（裁剪空间坐标）+ varyings</li>
            <li><strong>本 Demo 中</strong>: 使用 sin 函数叠加产生波浪；Simplex Noise 生成地形</li>
          </ul>
          <code style={styles.code}>
{`// 核心：修改 position.z
float elev = sin(pos.x * 3.0 + uTime * 2.0) * 0.3;
pos.z += elev;
gl_Position = projectionMatrix 
  * modelViewMatrix * vec4(pos, 1.0);`}
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🎭 Fragment Shader 片元着色器</h3>
          <p style={styles.sectionText}>
            <strong>逐像素执行</strong>（通常每帧数百万次），决定每个像素的最终颜色。
            是视觉效果的核心舞台。
          </p>
          <ul style={styles.list}>
            <li><strong>输入</strong>: varyings（顶点着色器插值后的值）+ uniforms</li>
            <li><strong>输出</strong>: gl_FragColor（RGBA 颜色）</li>
            <li><strong>本 Demo 中</strong>: HSV 彩虹、噪声热力图、条纹图案</li>
          </ul>
          <code style={styles.code}>
{`// HSV 彩虹渐变示例
float hue = vUv.x + uTime * 0.1;
vec3 color = hsv2rgb(vec3(hue, 0.8, 0.9));
gl_FragColor = vec4(color, 1.0);`}
          </code>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📦 数据类型：Uniforms / Attributes / Varyings</h3>
          <div style={styles.dataTable}>
            <div style={styles.dataRow}>
              <div style={{ ...styles.dataCell, color: '#4ecdc4' }}><strong>uniform</strong></div>
              <div style={styles.dataCell}>
                CPU → GPU 全局变量，<em>整个 draw call 中不变</em>。如时间 uTime、分辨率、纹理。
              </div>
            </div>
            <div style={styles.dataRow}>
              <div style={{ ...styles.dataCell, color: '#ff6b6b' }}><strong>attribute</strong></div>
              <div style={styles.dataCell}>
                逐顶点数据，<em>仅在 Vertex Shader 可读</em>。如 position, uv, normal。
              </div>
            </div>
            <div style={styles.dataRow}>
              <div style={{ ...styles.dataCell, color: '#ffd93d' }}><strong>varying</strong></div>
              <div style={styles.dataCell}>
                Vertex → Fragment 传递，<em>光栅化时自动插值</em>。用于传递 uv、高程等。
              </div>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>📝 GLSL 基础语法</h3>
          <ul style={styles.list}>
            <li><strong>强类型</strong>: float / int / vec2 / vec3 / vec4 / mat4</li>
            <li><strong>向量构造</strong>: vec3(1.0, 0.0, 0.5) / vec4(vec3, 1.0)</li>
            <li><strong>多分量访问</strong>: pos.xyz / color.rgb / uv.st / pos.xxyy</li>
            <li><strong>内置函数</strong>: sin, cos, abs, mix, smoothstep, floor, fract, dot, cross...</li>
            <li><strong>mix(a, b, t)</strong>: 线性插值 a + (b - a) * t</li>
            <li><strong>smoothstep(e0, e1, x)</strong>: 平滑 0→1 阶跃，抗锯齿利器</li>
          </ul>
        </section>

        <section style={styles.tipSection}>
          <h4 style={styles.tipTitle}>💡 操作提示</h4>
          <ul style={styles.list}>
            <li>点击上方按钮切换 4 种不同的 Shader 预设</li>
            <li>鼠标左键拖拽：旋转视角</li>
            <li>滚轮：缩放观察形变细节</li>
            <li>观察：顶点数 128×128 = 16,384 个，片元每帧百万级计算</li>
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
    width: '420px',
    minWidth: '420px',
    padding: '24px 28px',
    background: 'linear-gradient(180deg, #0a1a2e 0%, #1a0a3e 100%)',
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
    color: '#80a0c0',
  },
  presetSection: {
    marginBottom: '20px',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  presetBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#c0c0d8',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  presetBtnActive: {
    background: 'rgba(78,205,196,0.15)',
    borderColor: '#4ecdc4',
    color: '#fff',
    boxShadow: '0 0 20px rgba(78,205,196,0.2)',
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
    color: '#4ecdc4',
  },
  sectionText: {
    margin: '0 0 12px',
    fontSize: '13px',
    lineHeight: 1.7,
    color: '#c0c0d8',
  },
  pipeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '12px',
  },
  pipeItem: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#c0c0d8',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  pipeArrow: {
    textAlign: 'center',
    color: '#4ecdc4',
    fontSize: '14px',
    lineHeight: 1,
  },
  pipeNum: {
    display: 'inline-flex',
    width: '22px',
    height: '22px',
    background: 'rgba(78,205,196,0.3)',
    borderRadius: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: '#4ecdc4',
    flexShrink: 0,
  },
  list: {
    margin: '10px 0 0',
    paddingLeft: '18px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#c0c0d8',
  },
  code: {
    display: 'block',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#a0d8ef',
    overflowX: 'auto',
    lineHeight: 1.55,
    whiteSpace: 'pre',
    marginTop: '10px',
  },
  dataTable: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dataRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '10px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '6px',
  },
  dataCell: {
    fontSize: '12.5px',
    lineHeight: 1.6,
    color: '#c0c0d8',
  },
  tipSection: {
    marginTop: '24px',
    padding: '14px',
    background: 'rgba(78,205,196,0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(78,205,196,0.25)',
  },
  tipTitle: {
    margin: '0 0 8px 0',
    color: '#4ecdc4',
    fontSize: '14px',
  },
}

export default Shaders
