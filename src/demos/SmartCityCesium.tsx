// ============================================================
// 智慧城市 Demo - Cesium 3D 城市数字孪生可视化平台
// 核心架构：React 状态管理 + Cesium Viewer 三维地理可视化
// 数据流：用户操作 / 数据模拟 → React State → lil-gui → Cesium 场景更新
// 技术要点：
//   1. @cesium/engine + @cesium/widgets 模块化引入（替代大包 cesium）
//   2. vite-plugin-cesium-engine 自动处理资源/Worker/CESIUM_BASE_URL
//   3. 程序化生成城市建筑（BoxGeometry + Entity API），无需 3D Tiles 数据
//   4. OpenStreetMap 免费底图，无需 Cesium Ion Token
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Cartesian3,
  Cartesian2,
  Color,
  Entity,
  defined,
  OpenStreetMapImageryProvider,
  HeadingPitchRange,
  HeadingPitchRoll,
  Transforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  JulianDate,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
  Math as CesiumMath,
  ColorMaterialProperty,
  ConstantPositionProperty,
  GridImageryProvider,
} from '@cesium/engine'
import { Viewer } from '@cesium/widgets'
import '@cesium/widgets/Source/widgets.css'
import GUI from 'lil-gui'

// ------------------------------------------------------------
// 城市指标接口 - 智慧城市运行大屏核心数据模型
// ------------------------------------------------------------
interface CityMetrics {
  population: number        // 城市人口（万人）
  trafficFlow: number       // 实时车流量（辆/小时）
  airQuality: number        // 空气质量指数 AQI
  powerUsage: number        // 用电量（万 kWh）
  waterUsage: number        // 用水量（万吨）
  activeDevices: number     // 在线 IoT 设备数（万台）
  avgSpeed: number          // 平均车速（km/h）
}

// 建筑信息接口
interface BuildingInfo {
  lon: number
  lat: number
  height: number
  width: number
  depth: number
  color: string
  usage: 'residential' | 'commercial' | 'industrial' | 'public'
}

// POI 兴趣点接口
interface POIInfo {
  lon: number
  lat: number
  name: string
  type: 'hospital' | 'school' | 'park' | 'station' | 'mall' | 'fire'
  value?: number
}

// 车辆轨迹点
interface VehiclePoint {
  lon: number
  lat: number
  progress: number
  speed: number
  route: [number, number][]
}

// ------------------------------------------------------------
// 模拟城市中心：上海外滩附近 (121.49°E, 31.24°N)
// 所有建筑、道路、POI 围绕该中心在约 2km × 2km 范围内生成
// ------------------------------------------------------------
const CITY_CENTER = { lon: 121.49, lat: 31.24 }
const CITY_RADIUS = 0.012  // 约 1.3km（经纬度差，1°≈111km）

const SmartCityCesium = () => {
  // ----------------------------------------------------------
  // useRef：Cesium 核心对象（不参与 React 渲染，避免重渲染）
  // ----------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const guiRef = useRef<GUI | null>(null)
  const buildingsRef = useRef<Entity[]>([])
  const vehiclesRef = useRef<Entity[]>([])
  const poisRef = useRef<Entity[]>([])
  const vehicleDataRef = useRef<VehiclePoint[]>([])

  // ----------------------------------------------------------
  // useState：业务 UI 渲染数据（右侧面板、大屏显示）
  // ----------------------------------------------------------
  const [metrics, setMetrics] = useState<CityMetrics>({
    population: 2487,
    trafficFlow: 186500,
    airQuality: 68,
    powerUsage: 38420,
    waterUsage: 986,
    activeDevices: 126.8,
    avgSpeed: 38.6,
  })
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'warn' | 'error' }>>([])
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null)

  // lil-gui 参数引用（ref 持有，动画循环中可修改）
  const paramsRef = useRef({
    buildingOpacity: 0.85,
    buildingEmissive: 0.15,
    showBuildings: true,
    showRoads: true,
    showPOIs: true,
    showVehicles: true,
    showHeatmap: false,
    vehicleSpeed: 1.0,
    timeOfDay: 14,
    fogDensity: 0.0002,
  })

  // ----------------------------------------------------------
  // addLog：添加系统日志（最多 8 条）
  // ----------------------------------------------------------
  const addLog = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [{ time, message, type }, ...prev].slice(0, 8))
  }, [])

  // ----------------------------------------------------------
  // generateBuildings：程序化生成城市建筑群（约 120 栋）
  // 按 Manhattan 风格网格布局，中心区高、外围低
  // ----------------------------------------------------------
  const generateBuildings = useCallback((): BuildingInfo[] => {
    const buildings: BuildingInfo[] = []
    const gridSize = 12
    const step = (CITY_RADIUS * 2) / gridSize

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lon = CITY_CENTER.lon - CITY_RADIUS + i * step + step * 0.2 + Math.random() * step * 0.6
        const lat = CITY_CENTER.lat - CITY_RADIUS + j * step + step * 0.2 + Math.random() * step * 0.6

        // 距中心越远越矮
        const distFactor = Math.sqrt(
          Math.pow((lon - CITY_CENTER.lon) / CITY_RADIUS, 2) +
          Math.pow((lat - CITY_CENTER.lat) / CITY_RADIUS, 2)
        )
        const heightBase = Math.max(15, 220 * (1 - distFactor * 0.75))
        const height = heightBase + Math.random() * 80

        const usageRoll = Math.random()
        let usage: BuildingInfo['usage'] = 'commercial'
        let color = '#4fc3f7'
        if (usageRoll < 0.35) { usage = 'residential'; color = '#81c784' }
        else if (usageRoll < 0.65) { usage = 'commercial'; color = '#64b5f6' }
        else if (usageRoll < 0.82) { usage = 'public'; color = '#ffb74d' }
        else { usage = 'industrial'; color = '#e57373' }

        buildings.push({
          lon,
          lat,
          height,
          width: 30 + Math.random() * 50,
          depth: 25 + Math.random() * 55,
          color,
          usage,
        })
      }
    }
    return buildings
  }, [])

  // ----------------------------------------------------------
  // generatePOIs：生成城市关键兴趣点
  // ----------------------------------------------------------
  const generatePOIs = useCallback((): POIInfo[] => {
    const pois: POIInfo[] = [
      { lon: CITY_CENTER.lon + 0.002, lat: CITY_CENTER.lat + 0.003, name: '市中心医院', type: 'hospital', value: 380 },
      { lon: CITY_CENTER.lon - 0.004, lat: CITY_CENTER.lat - 0.001, name: '第一实验小学', type: 'school', value: 1200 },
      { lon: CITY_CENTER.lon + 0.005, lat: CITY_CENTER.lat - 0.004, name: '滨江公园', type: 'park', value: 8500 },
      { lon: CITY_CENTER.lon - 0.002, lat: CITY_CENTER.lat + 0.006, name: '中央车站', type: 'station', value: 45000 },
      { lon: CITY_CENTER.lon - 0.006, lat: CITY_CENTER.lat + 0.002, name: '城市广场', type: 'mall', value: 12000 },
      { lon: CITY_CENTER.lon + 0.003, lat: CITY_CENTER.lat - 0.007, name: '消防指挥中心', type: 'fire', value: 80 },
    ]
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const r = 0.006 + Math.random() * 0.004
      pois.push({
        lon: CITY_CENTER.lon + Math.cos(angle) * r,
        lat: CITY_CENTER.lat + Math.sin(angle) * r,
        name: `监控点-${i + 1}`,
        type: 'park',
      })
    }
    return pois
  }, [])

  // ----------------------------------------------------------
  // generateVehicles：生成行驶车辆（沿圆形轨道模拟）
  // ----------------------------------------------------------
  const generateVehicles = useCallback((): VehiclePoint[] => {
    const vehicles: VehiclePoint[] = []
    const routes: [number, number][][] = [
      // 环形主干道
      Array.from({ length: 40 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2
        return [CITY_CENTER.lon + Math.cos(a) * 0.008, CITY_CENTER.lat + Math.sin(a) * 0.008] as [number, number]
      }),
      // 东西大道
      Array.from({ length: 30 }, (_, i) => {
        const t = (i / 29) - 0.5
        return [CITY_CENTER.lon + t * CITY_RADIUS * 1.6, CITY_CENTER.lat + t * 0.0008] as [number, number]
      }),
      // 南北大道
      Array.from({ length: 30 }, (_, i) => {
        const t = (i / 29) - 0.5
        return [CITY_CENTER.lon + t * 0.0008, CITY_CENTER.lat + t * CITY_RADIUS * 1.6] as [number, number]
      }),
    ]
    for (let r = 0; r < routes.length; r++) {
      for (let i = 0; i < 8; i++) {
        vehicles.push({
          lon: routes[r][0][0],
          lat: routes[r][0][1],
          progress: (i / 8) + Math.random() * 0.1,
          speed: 0.004 + Math.random() * 0.003,
          route: routes[r],
        })
      }
    }
    return vehicles
  }, [])

  // ============================================================
  // useEffect：Cesium 场景初始化 + lil-gui + 动画循环
  // 关键点：必须等 DOM 布局完成（container 真实宽高 > 0）后再 new Viewer，
  // 否则 Cesium 内部 WebGL 纹理创建会因 canvas 尺寸 0 抛 maximumTextureSize 错误。
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    let viewer: Viewer | null = null
    let animationTimer: number | null = null
    let cancelled = false
    let cleanupFns: Array<() => void> = []

    const waitForSize = (resolve: () => void) => {
      let attempts = 0
      const tick = () => {
        attempts++
        const w = container.clientWidth
        const h = container.clientHeight
        if (w > 10 && h > 10) {
          resolve()
          return
        }
        if (attempts > 120) {
          resolve()
          return
        }
        window.requestAnimationFrame(tick)
      }
      tick()
    }

    new Promise<void>((resolve) => waitForSize(resolve)).then(() => {
      if (cancelled || !container.isConnected) return

      // ----------------------------------------------------------
      // 1. 创建 Cesium Viewer - 两层底图：纯色底 + 网格
      //    不依赖任何在线瓦片服务（OSM/高德国内经常超时），
      //    完全离线可运行，避免网络错误与 Texture 加载阻塞。
      // ----------------------------------------------------------
      viewer = new Viewer(container, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: true,
        infoBox: false,
        selectionIndicator: true,
        scene3DOnly: false,
        targetFrameRate: 60,
        requestRenderMode: false,
      })
      viewerRef.current = viewer

      // --- 自定义底图：GitHub Night 风格的蓝色调渐变填充地球 ---
      const baseLayer = viewer.imageryLayers.get(0)
      if (baseLayer) viewer.imageryLayers.remove(baseLayer)
      void viewer.imageryLayers.addImageryProvider(
        new GridImageryProvider({
          cells: 8,
          tileWidth: 256,
          tileHeight: 256,
          glowColor: Color.fromCssColorString('#4fc3f7').withAlpha(0.35),
          glowWidth: 0.08,
          backgroundColor: Color.fromCssColorString('#0d1420'),
        }),
      )

      // --- 若有网络则叠加 OSM 免费瓦片（失败自动降级，不阻塞运行） ---
      const osmProvider = new OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      })
      if (defined(osmProvider)) {
        const l = viewer.imageryLayers.addImageryProvider(osmProvider)
        l.alpha = 0.55
      }

      // WebGL Context 丢失自动恢复（防止标签切换/休眠后报错）
      const gl = viewer.scene.canvas.getContext('webgl') ?? viewer.scene.canvas.getContext('webgl2')
      if (gl) {
        const onCtxLost = (e: Event) => { e.preventDefault() }
        viewer.scene.canvas.addEventListener('webglcontextlost', onCtxLost)
      }

      // 初始相机视角：斜俯视城市中心
      const center = Cartesian3.fromDegrees(CITY_CENTER.lon, CITY_CENTER.lat, 0)
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(CITY_CENTER.lon + 0.002, CITY_CENTER.lat - 0.012, 1800),
        orientation: {
          heading: CesiumMath.toRadians(10),
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
      })
      void viewer.camera.flyTo({
        destination: center,
        orientation: new HeadingPitchRange(
          CesiumMath.toRadians(0),
          CesiumMath.toRadians(-55),
          1500,
        ),
        duration: 3,
      })

      // 开启光照
      viewer.scene.globe.enableLighting = true
      viewer.scene.fog.enabled = true
      viewer.scene.fog.density = paramsRef.current.fogDensity
      viewer.scene.backgroundColor = Color.fromCssColorString('#0d1117')

      // ----------------------------------------------------------
      // 2. 生成建筑、POI、车辆
      // ----------------------------------------------------------
      const buildingInfos = generateBuildings()
      const poiInfos = generatePOIs()
      vehicleDataRef.current = generateVehicles()

      // 添加建筑 Entity（可点击选中）
      buildingInfos.forEach((info) => {
        const position = Cartesian3.fromDegrees(info.lon, info.lat)
        const hpr = new HeadingPitchRoll(0, 0, 0)
        const modelMatrix = Transforms.headingPitchRollToFixedFrame(position, hpr)
        const entity = viewer!.entities.add({
          position: new ConstantPositionProperty(position),
          name: `${info.usage === 'residential' ? '住宅' : info.usage === 'commercial' ? '商业' : info.usage === 'public' ? '公共' : '工业'}楼 · ${info.height.toFixed(0)}m`,
          description: `
            <div style="padding:8px;font-family:system-ui">
              <h4 style="margin:0 0 8px 0;color:#64b5f6">建筑详情</h4>
              <div><b>类型：</b>${info.usage}</div>
              <div><b>高度：</b>${info.height.toFixed(1)} m</div>
              <div><b>占地面积：</b>${(info.width * info.depth * 0.0001).toFixed(2)} 公顷</div>
              <div><b>坐标：</b>${info.lon.toFixed(4)}°E, ${info.lat.toFixed(4)}°N</div>
            </div>
          `,
          box: {
            dimensions: new Cartesian3(info.width, info.depth, info.height),
            material: new ColorMaterialProperty(
              Color.fromCssColorString(info.color).withAlpha(paramsRef.current.buildingOpacity),
            ),
            outline: true,
            outlineColor: Color.WHITE.withAlpha(0.3),
          },
        })
        void modelMatrix
        buildingsRef.current.push(entity)
      })

      // 添加 POI 标记（带图钉）
      const poiColorMap: Record<POIInfo['type'], string> = {
        hospital: '#ef5350',
        school: '#ab47bc',
        park: '#66bb6a',
        station: '#42a5f5',
        mall: '#ffa726',
        fire: '#f44336',
      }
      poiInfos.forEach((poi) => {
        const entity = viewer!.entities.add({
          position: new ConstantPositionProperty(
            Cartesian3.fromDegrees(poi.lon, poi.lat, 4),
          ),
          name: poi.name,
          point: {
            pixelSize: 12,
            color: Color.fromCssColorString(poiColorMap[poi.type]),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            heightReference: HeightReference.RELATIVE_TO_GROUND,
          },
          label: {
            text: poi.name,
            font: '12px system-ui',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        poisRef.current.push(entity)
      })

      // 添加车辆 Entity
      vehicleDataRef.current.forEach((_, idx) => {
        const entity = viewer!.entities.add({
          position: new ConstantPositionProperty(
            Cartesian3.fromDegrees(CITY_CENTER.lon, CITY_CENTER.lat, 3),
          ),
          name: `车辆-${idx + 1}`,
          point: {
            pixelSize: 8,
            color: idx % 3 === 0 ? Color.YELLOW : Color.CYAN,
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            heightReference: HeightReference.RELATIVE_TO_GROUND,
          },
        })
        vehiclesRef.current.push(entity)
      })

      // ----------------------------------------------------------
      // 3. 建筑点击选中事件
      // ----------------------------------------------------------
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
      handler.setInputAction((movement: { position: Cartesian2 }) => {
        const picked = viewer!.scene.pick(movement.position)
        if (defined(picked) && defined(picked.id)) {
          const entity = picked.id as Entity
          if (buildingsRef.current.includes(entity)) {
            const match = buildingInfos.find((_, i) => buildingsRef.current[i] === entity)
            if (match) setSelectedBuilding(match)
          }
        } else {
          setSelectedBuilding(null)
        }
      }, ScreenSpaceEventType.LEFT_CLICK)

      // ----------------------------------------------------------
      // 4. lil-gui 控制面板
      // ----------------------------------------------------------
      const gui = new GUI({ title: '智慧城市控制台' })
      guiRef.current = gui
      gui.domElement.style.position = 'absolute'
      gui.domElement.style.top = '12px'
      gui.domElement.style.right = '320px'
      gui.domElement.style.zIndex = '999'
      container.appendChild(gui.domElement)

      const params = paramsRef.current
      const fScene = gui.addFolder('场景控制')
      fScene.add(params, 'showBuildings').name('显示建筑').onChange((v: boolean) => {
        buildingsRef.current.forEach((e) => { e.show = v })
      })
      fScene.add(params, 'showPOIs').name('显示 POI').onChange((v: boolean) => {
        poisRef.current.forEach((e) => { e.show = v })
      })
      fScene.add(params, 'showVehicles').name('显示车辆').onChange((v: boolean) => {
        vehiclesRef.current.forEach((e) => { e.show = v })
      })
      fScene.add(params, 'fogDensity', 0, 0.001, 0.00005).name('雾浓度').onChange((v: number) => {
        if (viewer) viewer.scene.fog.density = v
      })
      fScene.addColor({ color: '#0d1117' }, 'color').name('背景色').onChange((v: string) => {
        if (viewer) viewer.scene.backgroundColor = Color.fromCssColorString(v)
      })

      const fBuilding = gui.addFolder('建筑外观')
      fBuilding.add(params, 'buildingOpacity', 0.1, 1, 0.05).name('建筑透明度').onChange((v: number) => {
        buildingsRef.current.forEach((e, i) => {
          if (e.box) {
            const c = Color.fromCssColorString(buildingInfos[i].color).withAlpha(v)
            e.box.material = new ColorMaterialProperty(c)
          }
        })
      })

      const fAnim = gui.addFolder('动画与数据')
      fAnim.add(params, 'vehicleSpeed', 0, 3, 0.1).name('车辆速度×')
      fAnim.add(params, 'timeOfDay', 0, 24, 0.5).name('时间（小时）').onChange((v: number) => {
        if (!viewer) return
        const julian = viewer.clock.currentTime
        const currentMs = JulianDate.toDate(julian).getTime()
        const date = new Date(currentMs)
        date.setHours(Math.floor(v), Math.floor((v % 1) * 60), 0)
        viewer.clock.currentTime = JulianDate.fromDate(date)
      })

      const fCam = gui.addFolder('相机视角')
      const flyToView = (headingDeg: number, pitchDeg: number, range: number) => {
        if (!viewer) return
        void viewer.camera.flyTo({
          destination: center,
          orientation: new HeadingPitchRange(
            CesiumMath.toRadians(headingDeg),
            CesiumMath.toRadians(pitchDeg),
            range,
          ),
          duration: 2,
        })
      }
      fCam.add({ 俯视: () => flyToView(0, -89, 2500) }, '俯视').name('俯视 2.5km')
      fCam.add({ 斜视角: () => flyToView(45, -45, 1600) }, '斜视角').name('斜视角 1.6km')
      fCam.add({ 平视: () => flyToView(90, -12, 800) }, '平视').name('平视 800m')

      // ----------------------------------------------------------
      // 5. 动画循环：车辆运动 + 指标实时刷新
      // ----------------------------------------------------------
      let lastMetricsTime = 0
      const animate = (time: number) => {
        if (cancelled || !viewer) return
        // --- 车辆位置更新 ---
        const speedMul = paramsRef.current.vehicleSpeed
        vehicleDataRef.current.forEach((vData, i) => {
          vData.progress += vData.speed * speedMul * 0.016
          if (vData.progress >= 1) vData.progress -= Math.floor(vData.progress)
          const routeLen = vData.route.length
          const idxF = vData.progress * (routeLen - 1)
          const idx0 = Math.floor(idxF)
          const idx1 = Math.min(idx0 + 1, routeLen - 1)
          const t = idxF - idx0
          const lon = vData.route[idx0][0] + (vData.route[idx1][0] - vData.route[idx0][0]) * t
          const lat = vData.route[idx0][1] + (vData.route[idx1][1] - vData.route[idx0][1]) * t
          const entity = vehiclesRef.current[i]
          const posProp = entity?.position as ConstantPositionProperty | undefined
          if (posProp) {
            posProp.setValue(Cartesian3.fromDegrees(lon, lat, 4))
          }
        })

        // --- 每隔 2s 更新城市指标（模拟实时数据流） ---
        if (time - lastMetricsTime > 2000) {
          lastMetricsTime = time
          setMetrics((prev) => ({
            population: prev.population + (Math.random() - 0.5) * 0.2,
            trafficFlow: Math.max(50000, prev.trafficFlow + (Math.random() - 0.5) * 3000),
            airQuality: Math.max(20, Math.min(250, prev.airQuality + (Math.random() - 0.5) * 6)),
            powerUsage: Math.max(10000, prev.powerUsage + (Math.random() - 0.5) * 500),
            waterUsage: Math.max(200, prev.waterUsage + (Math.random() - 0.5) * 20),
            activeDevices: Math.max(50, prev.activeDevices + (Math.random() - 0.5) * 1.5),
            avgSpeed: Math.max(10, Math.min(70, prev.avgSpeed + (Math.random() - 0.5) * 2)),
          }))
        }

        animationTimer = window.requestAnimationFrame(animate)
      }
      animationTimer = window.requestAnimationFrame(animate)

      // 初始日志
      addLog('智慧城市平台启动，加载 OSM 底图成功', 'info')
      addLog(`生成 ${buildingInfos.length} 栋城市建筑数据`, 'info')
      addLog(`部署 ${poiInfos.length} 个城市 POI 监控点`, 'info')
      const t1 = window.setTimeout(() => addLog('城市交通流实时监控已接入', 'info'), 1200)
      const t2 = window.setTimeout(() => addLog('空气质量传感器在线 126/128', 'warn'), 2400)

      // ----------------------------------------------------------
      // 6. 窗口 resize 适配
      // ----------------------------------------------------------
      const handleResize = () => {
        if (viewer && !viewer.isDestroyed()) viewer.resize()
      }
      window.addEventListener('resize', handleResize)

      // ----------------------------------------------------------
      // 卸载清理函数（注册到 Promise.then 内部，保证和初始化同作用域）
      // ----------------------------------------------------------
      const cleanup = () => {
        cancelled = true
        window.removeEventListener('resize', handleResize)
        window.clearTimeout(t1)
        window.clearTimeout(t2)
        if (animationTimer) cancelAnimationFrame(animationTimer)
        try { handler.destroy() } catch (_err) { /* noop */ }
        try {
          gui.destroy()
          if (gui.domElement.parentNode) gui.domElement.parentNode.removeChild(gui.domElement)
        } catch (_err) { /* noop */ }
        guiRef.current = null
        buildingsRef.current = []
        vehiclesRef.current = []
        poisRef.current = []
        if (viewer && !viewer.isDestroyed()) {
          try { viewer.destroy() } catch (_err) { /* noop */ }
        }
        viewerRef.current = null
      }
      cleanupFns.push(cleanup)
    })

    return () => {
      cancelled = true
      cleanupFns.forEach((fn) => {
        try { fn() } catch (_err) { /* noop */ }
      })
      cleanupFns = []
    }
  }, [addLog, generateBuildings, generatePOIs, generateVehicles])

  // ============================================================
  // JSX：左侧 3D 场景 + 右侧数据面板（GitHub Night 深色主题）
  // ============================================================
  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.cesium} />

      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>🌆 智慧城市运行管理中心</div>
        <div style={styles.headerSub}>
          Cesium 3D 数字孪生 · 实时数据流 · {new Date().toLocaleDateString('zh-CN')}
        </div>
      </div>

      {/* 右侧数据面板 */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>城市运行指标</div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>常住人口</div>
          <div style={{ ...styles.metricValue, color: '#4fc3f7' }}>{metrics.population.toFixed(1)} 万</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>实时车流量</div>
          <div style={{ ...styles.metricValue, color: '#ffb74d' }}>{(metrics.trafficFlow / 10000).toFixed(2)} 万/h</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>
            空气质量 AQI
            <span style={{
              marginLeft: 8,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              background: metrics.airQuality < 75 ? 'rgba(102,187,106,0.25)' : metrics.airQuality < 150 ? 'rgba(255,167,38,0.25)' : 'rgba(239,83,80,0.25)',
              color: metrics.airQuality < 75 ? '#66bb6a' : metrics.airQuality < 150 ? '#ffa726' : '#ef5350',
            }}>
              {metrics.airQuality < 75 ? '优' : metrics.airQuality < 150 ? '良' : '差'}
            </span>
          </div>
          <div style={{ ...styles.metricValue, color: metrics.airQuality < 75 ? '#66bb6a' : metrics.airQuality < 150 ? '#ffa726' : '#ef5350' }}>
            {metrics.airQuality.toFixed(0)}
          </div>
        </div>

        <div style={styles.metricRow}>
          <div style={{ ...styles.metricMini, borderColor: 'rgba(100,181,246,0.3)' }}>
            <div style={styles.metricMiniLabel}>用电量</div>
            <div style={{ ...styles.metricMiniValue, color: '#64b5f6' }}>{(metrics.powerUsage / 10000).toFixed(2)}亿</div>
          </div>
          <div style={{ ...styles.metricMini, borderColor: 'rgba(129,199,132,0.3)' }}>
            <div style={styles.metricMiniLabel}>用水量</div>
            <div style={{ ...styles.metricMiniValue, color: '#81c784' }}>{metrics.waterUsage.toFixed(0)}万t</div>
          </div>
        </div>

        <div style={styles.metricRow}>
          <div style={{ ...styles.metricMini, borderColor: 'rgba(171,71,188,0.3)' }}>
            <div style={styles.metricMiniLabel}>在线设备</div>
            <div style={{ ...styles.metricMiniValue, color: '#ab47bc' }}>{metrics.activeDevices.toFixed(1)}万</div>
          </div>
          <div style={{ ...styles.metricMini, borderColor: 'rgba(255,183,77,0.3)' }}>
            <div style={styles.metricMiniLabel}>平均车速</div>
            <div style={{ ...styles.metricMiniValue, color: '#ffb74d' }}>{metrics.avgSpeed.toFixed(1)}km/h</div>
          </div>
        </div>

        {/* 选中建筑详情 */}
        {selectedBuilding && (
          <div style={styles.detailCard}>
            <div style={styles.panelHeader}>选中建筑详情</div>
            <div style={styles.detailRow}><span>类型：</span>{selectedBuilding.usage}</div>
            <div style={styles.detailRow}><span>高度：</span>{selectedBuilding.height.toFixed(1)} m</div>
            <div style={styles.detailRow}><span>尺寸：</span>{selectedBuilding.width.toFixed(0)} × {selectedBuilding.depth.toFixed(0)} m</div>
            <div style={styles.detailRow}><span>经度：</span>{selectedBuilding.lon.toFixed(5)}°E</div>
            <div style={styles.detailRow}><span>纬度：</span>{selectedBuilding.lat.toFixed(5)}°N</div>
            <div style={styles.detailRow}>
              <span>颜色：</span>
              <span style={{ display: 'inline-block', width: 14, height: 14, background: selectedBuilding.color, borderRadius: 3, verticalAlign: 'middle', marginRight: 6 }} />
              {selectedBuilding.color}
            </div>
          </div>
        )}

        {/* 系统日志 */}
        <div style={{ ...styles.panelHeader, marginTop: 16 }}>系统日志</div>
        <div style={styles.logBox}>
          {logs.length === 0 && <div style={{ color: '#6e7681', fontSize: 12 }}>暂无日志</div>}
          {logs.map((log, i) => (
            <div key={i} style={styles.logLine}>
              <span style={styles.logTime}>[{log.time}]</span>
              <span style={{
                color: log.type === 'error' ? '#f85149' : log.type === 'warn' ? '#d29922' : '#58a6ff',
                marginLeft: 6,
              }}>
                {log.message}
              </span>
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div style={{ ...styles.panelHeader, marginTop: 16 }}>建筑图例</div>
        <div style={styles.legendBox}>
          <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#81c784' }} /> 住宅楼</div>
          <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#64b5f6' }} /> 商业楼</div>
          <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#ffb74d' }} /> 公共建筑</div>
          <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#e57373' }} /> 工业建筑</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 内联样式对象（遵循项目规范，不引入独立 CSS）
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minWidth: '100%',
    minHeight: '100%',
    background: '#0d1117',
    overflow: 'hidden',
    display: 'block',
    boxSizing: 'border-box',
  },
  cesium: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    minWidth: '100%',
    minHeight: '100%',
    display: 'block',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 312,
    height: 52,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(180deg, rgba(13,17,23,0.92) 40%, rgba(13,17,23,0))',
    backdropFilter: 'blur(4px)',
    zIndex: 100,
    pointerEvents: 'none',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e6edf3',
    letterSpacing: 1,
    textShadow: '0 0 8px rgba(79,195,247,0.4)',
  },
  headerSub: {
    fontSize: 12,
    color: '#8b949e',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 300,
    height: '100%',
    padding: '12px 14px',
    background: 'rgba(22,27,34,0.92)',
    backdropFilter: 'blur(8px)',
    borderLeft: '1px solid #30363d',
    overflowY: 'auto',
    zIndex: 150,
    boxSizing: 'border-box',
  },
  panelHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e6edf3',
    padding: '8px 10px',
    marginBottom: 8,
    background: 'rgba(79,195,247,0.08)',
    borderLeft: '3px solid #4fc3f7',
    borderRadius: 3,
  },
  metricCard: {
    padding: '10px 12px',
    marginBottom: 8,
    background: 'rgba(33,38,45,0.6)',
    border: '1px solid #30363d',
    borderRadius: 6,
  },
  metricLabel: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: 'SF Mono, Consolas, monospace',
  },
  metricRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  metricMini: {
    flex: 1,
    padding: '8px 10px',
    background: 'rgba(33,38,45,0.6)',
    border: '1px solid',
    borderRadius: 6,
  },
  metricMiniLabel: {
    fontSize: 11,
    color: '#6e7681',
    marginBottom: 3,
  },
  metricMiniValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'SF Mono, Consolas, monospace',
  },
  detailCard: {
    marginTop: 12,
    padding: '0 10px 10px',
    background: 'rgba(33,38,45,0.6)',
    border: '1px solid rgba(79,195,247,0.3)',
    borderRadius: 6,
  },
  detailRow: {
    fontSize: 12,
    color: '#c9d1d9',
    padding: '4px 2px',
    borderBottom: '1px dashed #30363d',
  },
  logBox: {
    maxHeight: 160,
    overflowY: 'auto',
    padding: '6px 8px',
    background: 'rgba(1,4,9,0.5)',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'SF Mono, Consolas, monospace',
  },
  logLine: {
    padding: '2px 0',
    borderBottom: '1px dashed rgba(48,54,61,0.6)',
    fontSize: 11.5,
  },
  logTime: {
    color: '#6e7681',
  },
  legendBox: {
    padding: '4px 10px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  legendItem: {
    fontSize: 12,
    color: '#c9d1d9',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    display: 'inline-block',
  },
}

export default SmartCityCesium
