import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Dashboard from './pages/Dashboard'
import Categoria from './pages/Categoria'
import Inventario from './pages/Inventarios'
import Productos from './pages/Productos'



const Welcome = () => (
  <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
    <div className="max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/90 p-10 shadow-2xl shadow-slate-950/30">
      <h1 className="text-4xl font-bold mb-4">PartnerCentral Restaurant</h1>
      <p className="text-slate-300 leading-8">
        Este es el esqueleto inicial para el módulo de restaurante. Aquí puedes conectar tu AuthGuard, SyncContext y las rutas específicas de restaurant.
      </p>
      <p className="mt-6 text-slate-400">Puerto de desarrollo: <strong>5176</strong></p>
    </div>
  </main>
)

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/categoria" element={<Categoria />} />
        <Route path="/inventarios" element={<Inventario />} />
        <Route path="/productos" element={<Productos/>} />
      </Routes>
    </Router>
  )
}

export default App
