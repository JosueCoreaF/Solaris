// App.tsx - Versión corregida
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Dashboard from '../src/Pages/Dashboard'
import ReporteComida from '../src/Pages/Reporte_comida'
import ReportePedido from '../src/Pages/Reporte_pedido'
import ReporteProductos from '../src/Pages/Reporte_productos'
import ReportePromocio from '../src/Pages/Reporte_promocio'
import ReporteIngreso from '../src/Pages/Reporteingreso' 



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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reportes/ingresos" element={<ReporteIngreso />} />
        <Route path="/reportes/promocion" element={<ReportePromocio />} />
        <Route path="/reportes/pedidos" element={<ReportePedido />} />
        <Route path="/reportes/producto" element={<ReporteProductos />} />
        <Route path="/reportes/plato" element={<ReporteComida />} />
        <Route path="/" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App