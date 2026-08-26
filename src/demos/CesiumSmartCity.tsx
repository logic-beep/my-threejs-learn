// ============================================================
// Cesium 智慧城市 Demo - 基于真实地理坐标系的数字孪生园区
// 核心架构：Resium（Cesium React 封装）声明式 + 经纬度坐标
// 与 Three.js 版区别：内置地球/地形/影像，坐标用 WGS84 经纬度+海拔
// 包含：影像底图 + 建筑白模（拉伸几何体） + IoT 传感器点位 + 状态面板
// ============================================================

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Viewer,
  ImageryLayer,
  Entity,
  CameraFlyTo,
  ScreenSpaceEventHandler,
  ScreenSpaceEvent,
} from 'resium'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import GUI from 'lil-gui'

// ------------------------------------------------------------
// 园区中心坐标：虚拟点（东经 121.5°，北纬 31.2°，上海附近东海海面）
// 使用一个假想的"智慧产业园区"，坐标偏移量以米为单位换算
// ------------------------------------------------------------
const PARK_CENTER = {
  lon: 121.5,
  lat: 31.2,
  height: 0,
}

// ------------------------------------------------------------
// 传感器状态接口
// ------------------------------------------------------------
interface SensorState {
  id: string
  name: string
  lonOffset: number
  latOffset: number
  height: number
  type: 'air' | 'water' | 'power' | 'traffic'
  status: 'normal' | 'warning' | 'error'
  value: number
  threshold: { warn: number; error: number }
}

interface BuildingInfo {
  id: string
  name: string
  lonOffset: number
  latOffset: number
  widthMeters: number
  lengthMeters: number
  heightMeters: number
  color: string
}

// ------------------------------------------------------------
// 1. 构建建筑列表：8 栋楼组成一个小型园区
//    用经纬度偏移（1° ≈ 111km，所以 0.001° ≈ 111m）
// ------------------------------------------------------------
const BUILDINGS: BuildingInfo[] = [
  { id: 'B1', name: '研发中心 A 座', lonOffset: -0.0025, latOffset:  0.0020, widthMeters: 50, lengthMeters: 70, heightMeters: 80,  color: '#4a90d9' },
  { id: 'B2', name: '研发中心 B 座', lonOffset:  0.0005, latOffset:  0.0020, widthMeters: 40, lengthMeters: 60, heightMeters: 60,  color: '#5aa0e9' },
  { id: 'B3', name: '行政办公楼',   lonOffset:  0.0030, latOffset:  0.0020, widthMeters: 60, lengthMeters: 45, heightMeters: 45,  color: '#6ab0f9' },
  { id: 'B4', name: '生产车间 1 号', lonOffset: -0.0020, latOffset: -0.0010, widthMeters: 80, lengthMeters: 50, heightMeters: 25,  color: '#7ab099' },
  { id: 'B5', name: '生产车间 2 号', lonOffset:  0.0010, latOffset: -0.0015, widthMeters: 70, lengthMeters: 55, heightMeters: 28,  color: '#8ac0a9' },
  { id: 'B6', name: '仓储物流中心', lonOffset:  0.0035, latOffset: -0.0010, widthMeters: 90, lengthMeters: 60, heightMeters: 18,  color: '#b0a070' },
  { id: 'B7', name: '员工宿舍楼',   lonOffset: -0.0020, latOffset: -0.0035, widthMeters: 45, lengthMeters: 35, heightMeters: 55,  color: '#d09080' },
  { id: 'B8', name: '数据中心机房', lonOffset:  0.0025, latOffset: -0.0035, widthMeters: 40, lengthMeters: 40, heightMeters: 20,  color: '#a080c0' },
]

// ------------------------------------------------------------
// 2. 构建传感器列表：6 个 IoT 监测点
// ------------------------------------------------------------
const INITIAL_SENSORS: SensorState[] = [
  { id: 'S1', name: '园区北门空气质量',   lonOffset: -0.0030, latOffset:  0.0030, height: 8,  type: 'air',     status: 'normal', value: 35,  threshold: { warn: 75,  error: 150 } },
  { id: 'S2', name: '生产区 PM2.5',       lonOffset: -0.0010, latOffset: -0.0010, height: 12, type: 'air',     status: 'warning', value: 88, threshold: { warn: 75,  error: 150 } },
  { id: 'S3', name: '消防水池水位',       lonOffset:  0.0030, latOffset:  0.0000, height: 3,  type: 'water',   status: 'normal', value: 82,  threshold: { warn: 40,  error: 20  } },
  { id: 'S4', name: '主变电站负载率',     lonOffset:  0.0030, latOffset: -0.0030, height: 6,  type: 'power',   status: 'error',  value: 95,  threshold: { warn: 70,  error: 90  } },
  { id: 'S5', name: '主干道车流拥堵度',   lonOffset:  0.0000, latOffset: -0.0045, height: 5,  type: 'traffic', status: 'warning', value: 68, threshold: { warn: 60,  error: 85  } },
  { id: 'S6', name: '污水处理出口水质',   lonOffset: -0.0030, latOffset: -0.0035, height: 4,  type: 'water',   status: 'normal', value: 18,  threshold: { warn: 50,  error: 70  } },
]

const SENSOR_TYPE_COLORS: Record<SensorState['type'], string> = {
  air: '#ffcc00',
  water: '#00bbff',
  power: '#ff8800',
  traffic: '#00dd88',
}

const STATUS_COLORS = {
  normal:  '#00ff66',
  warning: '#ffaa00',
  error:   '#ff3355',
}

// ============================================================
// 组件主体
// ============================================================
export default function CesiumSmartCity() {
  const containerRef = useRef<HTMLDivElement>(null)
  const guiRef = useRef<GUI | null>(null)
  const viewerRef = useRef<Cesium.Viewer>(null!)
  const initializedRef = useRef(false)

  const [sensors, setSensors] = useState<SensorState[]>(() =>
    INITIAL_SENSORS.map((s) => ({ ...s }))
  )
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null)
  const [clock, setClock] = useState(0)

  // lil-gui 可调参数
  const paramsRef = useRef({
    showBuildings: true,
    showSensors: true,
    buildingOpacity: 0.9,
    sensorPointSize: 14,
    alertBlinkSpeed: 2.5,
    dataRefreshInterval: 2,
    cameraTilt: 45,
    cameraDistance: 1200,
  })

  // ----------------------------------------------------------
  // 相机飞到园区中心（根据 params 计算位置）
  // ----------------------------------------------------------
  const flyToPark = useMemo(
    () => () => {
      const v = viewerRef.current
      if (!v) return
      const pitch = Cesium.Math.toRadians(-paramsRef.current.cameraTilt)
      const heading = Cesium.Math.toRadians(30)
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          PARK_CENTER.lon,
          PARK_CENTER.lat,
          paramsRef.current.cameraDistance
        ),
        orientation: {
          heading,
          pitch,
          roll: 0,
        },
        duration: 1.5,
      })
    },
    []
  )

  // ----------------------------------------------------------
  // lil-gui 初始化（组件挂载时）
  // ----------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return

    const gui = new GUI({ title: '智慧城市参数' })
    guiRef.current = gui
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '12px'
    gui.domElement.style.right = '12px'
    gui.domElement.style.zIndex = '1000'
    containerRef.current.appendChild(gui.domElement)

    const fView = gui.addFolder('视图')
    fView.add(paramsRef.current, 'cameraTilt', 10, 80, 1).name('相机俯仰角(°)')
    fView.add(paramsRef.current, 'cameraDistance', 300, 4000, 50).name('相机距离(m)')
      .onFinishChange(() => flyToPark())
    fView.add({ '飞到园区': () => flyToPark() }, '飞到园区')

    const fObj = gui.addFolder('显示对象')
    fObj.add(paramsRef.current, 'showBuildings').name('显示建筑')
    fObj.add(paramsRef.current, 'showSensors').name('显示传感器')
    fObj.add(paramsRef.current, 'buildingOpacity', 0.1, 1.0, 0.05).name('建筑透明度')
    fObj.add(paramsRef.current, 'sensorPointSize', 6, 30, 1).name('传感器点大小')

    const fAlert = gui.addFolder('告警与数据')
    fAlert.add(paramsRef.current, 'alertBlinkSpeed', 0.5, 8, 0.1).name('告警闪烁速度')
    fAlert.add(paramsRef.current, 'dataRefreshInterval', 0.5, 5, 0.1).name('刷新间隔(秒)')

    return () => {
      gui.destroy()
      if (gui.domElement.parentNode) {
        gui.domElement.parentNode.removeChild(gui.domElement)
      }
      guiRef.current = null
    }
  }, [flyToPark])

  // ----------------------------------------------------------
  // 数据模拟刷新：周期性更新传感器读数
  // ----------------------------------------------------------
  useEffect(() => {
    let timerId: number | undefined
    const tick = () => {
      setSensors((prev) =>
        prev.map((s) => {
          const delta = (Math.random() - 0.5) * (s.threshold.warn * 0.15)
          let newValue = s.value + delta
          newValue = Math.max(0, Math.min(s.threshold.error * 1.3, newValue))
          let newStatus: SensorState['status'] = 'normal'
          if (s.type === 'water') {
            if (newValue <= s.threshold.warn) newStatus = 'warning'
            if (newValue <= s.threshold.error) newStatus = 'error'
          } else {
            if (newValue >= s.threshold.warn) newStatus = 'warning'
            if (newValue >= s.threshold.error) newStatus = 'error'
          }
          return { ...s, value: newValue, status: newStatus }
        })
      )
      setClock((c) => c + 1)
      timerId = window.setTimeout(tick, paramsRef.current.dataRefreshInterval * 1000)
    }
    timerId = window.setTimeout(tick, paramsRef.current.dataRefreshInterval * 1000)
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId)
    }
  }, [])

  // ----------------------------------------------------------
  // Viewer 初始化：通过 callback ref 拿到实例后做一次性配置
  // ----------------------------------------------------------
  const viewerRefCallback = useMemo(
    () => (instance: unknown) => {
      if (!instance || initializedRef.current) return
      // Resium 的 ref 会给一个包装了 Cesium.Viewer 的对象，也可能直接就是 Viewer
      // 我们试着取 viewer.current，或者直接当 Viewer 用
      const anyInst = instance as { viewer?: Cesium.Viewer }
      const v: Cesium.Viewer | undefined = (anyInst.viewer ?? instance) as Cesium.Viewer | undefined
      if (v && typeof (v as unknown as { scene: unknown }).scene === 'object') {
        initializedRef.current = true
        viewerRef.current = v
        v.scene.globe.depthTestAgainstTerrain = false
        ;(v.cesiumWidget.creditContainer as HTMLElement).style.display = 'none'
        setTimeout(() => flyToPark(), 100)
      }
    },
    [flyToPark]
  )

  // ----------------------------------------------------------
  // 点击传感器时的事件处理
  // ----------------------------------------------------------
  const handleSensorClick = (sensor: SensorState) => {
    setSelectedSensorId((prev) => (prev === sensor.id ? null : sensor.id))
  }

  // ----------------------------------------------------------
  // 统计信息
  // ----------------------------------------------------------
  const stats = useMemo(() => {
    const normal = sensors.filter((s) => s.status === 'normal').length
    const warning = sensors.filter((s) => s.status === 'warning').length
    const error = sensors.filter((s) => s.status === 'error').length
    return { normal, warning, error, total: sensors.length }
  }, [sensors])

  const selectedSensor = sensors.find((s) => s.id === selectedSensorId) || null

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div ref={containerRef} style={styles.container}>
      {/* -------------------------------------------------- */}
      {/* Cesium Viewer */}
      {/* -------------------------------------------------- */}
      <Viewer
        ref={viewerRefCallback}
        full
        style={styles.viewer}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        infoBox={false}
        selectionIndicator={false}
        shouldAnimate
      >
        {/* 影像图层：OpenStreetMap 免费底图 */}
        <ImageryLayer
          imageryProvider={new Cesium.UrlTemplateImageryProvider({
            url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '© OpenStreetMap contributors',
            maximumLevel: 19,
          })}
          show
        />

        {/* 初始相机飞行 */}
        <CameraFlyTo
          duration={0}
          destination={Cesium.Cartesian3.fromDegrees(
            PARK_CENTER.lon,
            PARK_CENTER.lat,
            paramsRef.current.cameraDistance
          )}
          orientation={{
            heading: Cesium.Math.toRadians(30),
            pitch: Cesium.Math.toRadians(-paramsRef.current.cameraTilt),
            roll: 0,
          }}
        />

        {/* -------------------------------------------------- */}
        {/* 园区边界（矩形面 + 边框） */}
        {/* -------------------------------------------------- */}
        <Entity
          name="园区边界"
          rectangle={{
            coordinates: Cesium.Rectangle.fromDegrees(
              PARK_CENTER.lon - 0.0045,
              PARK_CENTER.lat - 0.005,
              PARK_CENTER.lon + 0.005,
              PARK_CENTER.lat + 0.0035
            ),
            material: Cesium.Color.fromCssColorString('#1a3d6f').withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#4aa3ff').withAlpha(0.8),
            height: 0.1,
          }}
        />

        {/* -------------------------------------------------- */}
        {/* 建筑：用 Entity polygon + extrudedHeight 做拉伸缩放体 */}
        {/* -------------------------------------------------- */}
        {paramsRef.current.showBuildings &&
          BUILDINGS.map((b) => {
            const halfW = (b.widthMeters / 2) / 111000
            const halfL = (b.lengthMeters / 2) / 111000
            const lon = PARK_CENTER.lon + b.lonOffset
            const lat = PARK_CENTER.lat + b.latOffset
            return (
              <Entity
                key={b.id}
                name={b.name}
                description={`<b>${b.name}</b><br/>层数: ${Math.round(b.heightMeters / 3)}F<br/>高度: ${b.heightMeters}m`}
                polygon={{
                  hierarchy: Cesium.Cartesian3.fromDegreesArray([
                    lon - halfW, lat - halfL,
                    lon + halfW, lat - halfL,
                    lon + halfW, lat + halfL,
                    lon - halfW, lat + halfL,
                  ]),
                  height: 0,
                  extrudedHeight: b.heightMeters,
                  material: Cesium.Color.fromCssColorString(b.color).withAlpha(
                    paramsRef.current.buildingOpacity
                  ),
                  outline: true,
                  outlineColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.2),
                }}
              />
            )
          })}

        {/* -------------------------------------------------- */}
        {/* 传感器点：点图标 + 告警闪烁通过颜色透明度动态表现 */}
        {/* -------------------------------------------------- */}
        {paramsRef.current.showSensors &&
          sensors.map((s) => {
            const lon = PARK_CENTER.lon + s.lonOffset
            const lat = PARK_CENTER.lat + s.latOffset
            const isSelected = s.id === selectedSensorId
            const blinkPhase =
              s.status !== 'normal'
                ? 0.5 + 0.5 * Math.sin(clock * paramsRef.current.alertBlinkSpeed)
                : 1
            return (
              <Entity
                key={s.id}
                name={s.name}
                position={Cesium.Cartesian3.fromDegrees(lon, lat, s.height)}
                onClick={() => handleSensorClick(s)}
                point={{
                  pixelSize:
                    paramsRef.current.sensorPointSize + (isSelected ? 6 : 0),
                  color: Cesium.Color.fromCssColorString(STATUS_COLORS[s.status]).withAlpha(
                    blinkPhase
                  ),
                  outlineColor: isSelected
                    ? Cesium.Color.WHITE
                    : Cesium.Color.fromCssColorString(SENSOR_TYPE_COLORS[s.type]),
                  outlineWidth: isSelected ? 3 : 2,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }}
              />
            )
          })}

        {/* 全局点击处理（点击空白处取消选中） */}
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent
            type={Cesium.ScreenSpaceEventType.LEFT_CLICK}
            action={() => setSelectedSensorId(null)}
          />
        </ScreenSpaceEventHandler>
      </Viewer>

      {/* -------------------------------------------------- */}
      {/* 左上角：标题 + 概览面板 */}
      {/* -------------------------------------------------- */}
      <div style={styles.titleBar}>
        <div style={styles.title}>🏙️ 智慧产业园区 · 数字孪生驾驶舱</div>
        <div style={styles.titleSubtitle}>
          Cesium + Resium · 真实经纬度坐标 · 数据每 {paramsRef.current.dataRefreshInterval.toFixed(1)}s 刷新
        </div>
      </div>

      <div style={styles.statsPanel}>
        <div style={styles.statsTitle}>全局运行状态</div>
        <div style={styles.statsRow}>
          <StatBox label="设备总数" value={stats.total} color="#ffffff" />
          <StatBox label="正常" value={stats.normal} color={STATUS_COLORS.normal} />
          <StatBox label="告警" value={stats.warning} color={STATUS_COLORS.warning} />
          <StatBox label="故障" value={stats.error} color={STATUS_COLORS.error} />
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* 左下角：传感器列表 */}
      {/* -------------------------------------------------- */}
      <div style={styles.sensorListPanel}>
        <div style={styles.panelTitle}>设备监测点</div>
        <div style={styles.sensorList}>
          {sensors.map((s) => {
            const isSel = s.id === selectedSensorId
            return (
              <div
                key={s.id}
                style={{
                  ...styles.sensorItem,
                  borderColor: isSel ? '#ffffff' : 'transparent',
                  background: isSel ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.25)',
                }}
                onClick={() => handleSensorClick(s)}
              >
                <div
                  style={{
                    ...styles.statusDot,
                    background: STATUS_COLORS[s.status],
                    boxShadow: `0 0 8px ${STATUS_COLORS[s.status]}`,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={styles.sensorName}>{s.name}</div>
                  <div style={styles.sensorMeta}>
                    <span style={{ color: SENSOR_TYPE_COLORS[s.type] }}>
                      {sensorTypeLabel(s.type)}
                    </span>
                  </div>
                </div>
                <div style={{ ...styles.sensorValue, color: STATUS_COLORS[s.status] }}>
                  {s.value.toFixed(0)}
                  <span style={styles.sensorUnit}>{sensorUnit(s.type)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* 右下角：选中传感器详情 */}
      {/* -------------------------------------------------- */}
      {selectedSensor && (
        <div style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <span style={styles.detailTitle}>{selectedSensor.name}</span>
            <span
              style={{
                ...styles.statusBadge,
                background: STATUS_COLORS[selectedSensor.status],
              }}
            >
              {statusLabel(selectedSensor.status)}
            </span>
          </div>
          <div style={styles.detailBody}>
            <DetailRow label="类型" value={sensorTypeLabel(selectedSensor.type)} />
            <DetailRow label="当前读数" value={selectedSensor.value.toFixed(1) + sensorUnit(selectedSensor.type)} />
            <DetailRow
              label="告警阈值"
              value={`警告≥${selectedSensor.threshold.warn}  故障≥${selectedSensor.threshold.error}`}
            />
            <DetailRow
              label="位置"
              value={`东经 ${(PARK_CENTER.lon + selectedSensor.lonOffset).toFixed(5)}°
北纬 ${(PARK_CENTER.lat + selectedSensor.latOffset).toFixed(5)}°
海拔 ${selectedSensor.height}m`}
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* 底部：图例 */}
      {/* -------------------------------------------------- */}
      <div style={styles.legendBar}>
        <LegendItem color="#4a90d9" label="建筑" />
        <LegendItem color="#00ff66" label="正常" />
        <LegendItem color="#ffaa00" label="告警" />
        <LegendItem color="#ff3355" label="故障" />
        <span style={{ ...styles.legendSep }} />
        <LegendItem color="#ffcc00" label="大气" />
        <LegendItem color="#00bbff" label="水务" />
        <LegendItem color="#ff8800" label="电力" />
        <LegendItem color="#00dd88" label="交通" />
      </div>
    </div>
  )
}

// ============================================================
// 小组件
// ============================================================
function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailRowLabel}>{label}</div>
      <div style={styles.detailRowValue}>{value}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={styles.legendItem}>
      <div style={{ ...styles.legendDot, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={styles.legendLabel}>{label}</span>
    </div>
  )
}

// ============================================================
// 辅助函数
// ============================================================
function sensorTypeLabel(t: SensorState['type']): string {
  return { air: '大气监测', water: '水务监测', power: '电力监测', traffic: '交通监测' }[t]
}
function sensorUnit(t: SensorState['type']): string {
  return { air: 'μg/m³', water: 'mg/L', power: '%', traffic: '%' }[t]
}
function statusLabel(s: SensorState['status']): string {
  return { normal: '正常', warning: '告警', error: '故障' }[s]
}

// ============================================================
// 样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#000',
    overflow: 'hidden',
    fontFamily:
      '"Microsoft YaHei", "PingFang SC", system-ui, -apple-system, sans-serif',
    color: '#e6f1ff',
  },
  viewer: {
    position: 'absolute',
    inset: 0,
    background: '#020913',
  },
  titleBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    background: 'linear-gradient(90deg, rgba(10,40,80,0.92), rgba(10,40,80,0.55) 70%, rgba(10,40,80,0))',
    padding: '10px 20px',
    borderRadius: 6,
    border: '1px solid rgba(74,163,255,0.35)',
    backdropFilter: 'blur(4px)',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    color: '#cfe8ff',
    textShadow: '0 0 8px rgba(74,163,255,0.6)',
  },
  titleSubtitle: {
    fontSize: 12,
    marginTop: 4,
    color: '#7aa9d6',
  },
  statsPanel: {
    position: 'absolute',
    top: 90,
    left: 12,
    zIndex: 10,
    width: 320,
    background: 'rgba(8,24,48,0.85)',
    border: '1px solid rgba(74,163,255,0.3)',
    borderRadius: 6,
    padding: '10px 14px 14px',
    backdropFilter: 'blur(4px)',
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#9fc8f0',
    marginBottom: 10,
    borderLeft: '3px solid #4aa3ff',
    paddingLeft: 8,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  statBox: {
    textAlign: 'center',
    padding: '8px 4px',
    background: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#7aa9d6',
  },
  sensorListPanel: {
    position: 'absolute',
    bottom: 56,
    left: 12,
    zIndex: 10,
    width: 340,
    maxHeight: '45%',
    background: 'rgba(8,24,48,0.85)',
    border: '1px solid rgba(74,163,255,0.3)',
    borderRadius: 6,
    padding: 10,
    backdropFilter: 'blur(4px)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#9fc8f0',
    marginBottom: 10,
    borderLeft: '3px solid #4aa3ff',
    paddingLeft: 8,
    flexShrink: 0,
  },
  sensorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    paddingRight: 4,
  },
  sensorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  sensorName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e6f1ff',
  },
  sensorMeta: {
    fontSize: 11,
    marginTop: 2,
    color: '#7aa9d6',
  },
  sensorValue: {
    fontSize: 20,
    fontWeight: 800,
    textAlign: 'right',
    lineHeight: 1,
  },
  sensorUnit: {
    fontSize: 10,
    marginLeft: 2,
    fontWeight: 500,
    opacity: 0.7,
  },
  detailPanel: {
    position: 'absolute',
    bottom: 56,
    right: 12,
    zIndex: 10,
    width: 290,
    background: 'rgba(8,24,48,0.9)',
    border: '1px solid rgba(74,163,255,0.4)',
    borderRadius: 6,
    backdropFilter: 'blur(4px)',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'linear-gradient(90deg, rgba(74,163,255,0.25), transparent)',
    borderBottom: '1px solid rgba(74,163,255,0.2)',
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e6f1ff',
  },
  statusBadge: {
    fontSize: 11,
    padding: '2px 10px',
    borderRadius: 10,
    color: '#001322',
    fontWeight: 700,
  },
  detailBody: {
    padding: '10px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 10,
    fontSize: 12,
  },
  detailRowLabel: {
    color: '#7aa9d6',
    width: 70,
    flexShrink: 0,
  },
  detailRowValue: {
    color: '#e6f1ff',
    flex: 1,
    whiteSpace: 'pre-line',
    fontWeight: 600,
  },
  legendBar: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '6px 18px',
    background: 'rgba(8,24,48,0.85)',
    border: '1px solid rgba(74,163,255,0.3)',
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  legendLabel: {
    fontSize: 11,
    color: '#b6d4f2',
  },
  legendSep: {
    width: 1,
    height: 14,
    background: 'rgba(150,190,230,0.3)',
    marginLeft: 4,
    marginRight: 4,
  },
}
