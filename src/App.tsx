import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import BasicScene from './demos/BasicScene'
import Geometries from './demos/Geometries'
import MaterialsTextures from './demos/MaterialsTextures'
import LightingShadows from './demos/LightingShadows'
import AnimationInteraction from './demos/AnimationInteraction'
import ParticleSystem from './demos/ParticleSystem'
import Shaders from './demos/Shaders'
import LoadModel from './demos/LoadModel'
import DigitalTwin from './demos/DigitalTwin'
import DigitalTwinR3F from './demos/DigitalTwinR3F'
import ReactThreeFiberDemo from './demos/ReactThreeFiberDemo'
import CesiumSmartCity from './demos/CesiumSmartCity'

const demos = [
  { path: '/cesium-smart-city', label: '智慧城市 (Cesium版)' },
  { path: '/digital-twin', label: '数字孪生 (原生 Three)' },
  { path: '/digital-twin-r3f', label: '数字孪生 (R3F版)' },
  { path: '/r3f', label: 'R3F + drei 学习' },
  { path: '/basic', label: '基础场景' },
  { path: '/geometries', label: '几何体' },
  { path: '/materials', label: '材质' },
  { path: '/lighting', label: '光照' },
  { path: '/interaction', label: '交互' },
  { path: '/particles', label: '粒子' },
  { path: '/shaders', label: '着色器' },
  { path: '/model', label: '模型加载' },
]

function BasicDemo() {
  return <BasicScene />
}

function GeometriesDemo() {
  return <Geometries />
}

function MaterialsDemo() {
  return <MaterialsTextures />
}

function LightingDemo() {
  return <LightingShadows />
}

function InteractionDemo() {
  return <AnimationInteraction />
}

function ParticlesDemo() {
  return <ParticleSystem />
}

function ShadersDemo() {
  return <Shaders />
}

function ModelDemo() {
  return <LoadModel />
}

function DigitalTwinDemo() {
  return <DigitalTwin />
}

function DigitalTwinR3FDemo() {
  return <DigitalTwinR3F />
}

function R3FDemo() {
  return <ReactThreeFiberDemo />
}

function CesiumSmartCityDemo() {
  return <CesiumSmartCity />
}

function App() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Three.js Demo</h1>
        </div>
        <nav className="sidebar-nav">
          {demos.map((demo) => (
            <NavLink
              key={demo.path}
              to={demo.path}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              {demo.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/cesium-smart-city" replace />} />
          <Route path="/cesium-smart-city" element={<CesiumSmartCityDemo />} />
          <Route path="/digital-twin" element={<DigitalTwinDemo />} />
          <Route path="/digital-twin-r3f" element={<DigitalTwinR3FDemo />} />
          <Route path="/r3f" element={<R3FDemo />} />
          <Route path="/basic" element={<BasicDemo />} />
          <Route path="/geometries" element={<GeometriesDemo />} />
          <Route path="/materials" element={<MaterialsDemo />} />
          <Route path="/lighting" element={<LightingDemo />} />
          <Route path="/interaction" element={<InteractionDemo />} />
          <Route path="/particles" element={<ParticlesDemo />} />
          <Route path="/shaders" element={<ShadersDemo />} />
          <Route path="/model" element={<ModelDemo />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
