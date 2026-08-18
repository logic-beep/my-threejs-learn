import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import BasicScene from './demos/BasicScene'
import Geometries from './demos/Geometries'
import MaterialsTextures from './demos/MaterialsTextures'
import LightingShadows from './demos/LightingShadows'
import AnimationInteraction from './demos/AnimationInteraction'
import ParticleSystem from './demos/ParticleSystem'
import Shaders from './demos/Shaders'
import LoadModel from './demos/LoadModel'

const demos = [
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
          <Route path="/" element={<Navigate to="/basic" replace />} />
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
