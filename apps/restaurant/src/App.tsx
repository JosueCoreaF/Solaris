import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Dashboard from '../src/Pages/Dashboard';
import reporte_comida from '../src/Pages/reporte_comida'
import reporte_pedido from '../src/Pages/reporte_pedido'
import reporte_productos from '../src/Pages/reporte_productos'
import reporteingreso from '../src/Pages/reporte_promocio'
import reporte_promociones from '../src/Pages/reporteingreso'
import Reporteingreso from '../src/Pages/reporteingreso';
import Reporte_promocio from '../src/Pages/reporte_promocio';
import Reporte_pedido from '../src/Pages/reporte_pedido';
import Reporte_productos from '../src/Pages/reporte_productos';
import Reporte_Comida from '../src/Pages/reporte_comida';


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
         <Route path="/reportes/ingresos" element={<Reporteingreso />} />
        <Route path="/reportes/promocion" element={<Reporte_promocio/>} />
        <Route path="/reportes/pedidos" element={<Reporte_pedido />} />
        <Route path="/reportes/producto" element={<Reporte_productos/>} />
        <Route path="/reportes/plato" element={<Reporte_Comida/>} />
      </Routes>
    </Router>
  )
}

export default App
