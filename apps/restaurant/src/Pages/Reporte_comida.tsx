import { useNavigate } from 'react-router-dom'
import Topvar from '../components/Topvar'

export default function Reporte_Comida() {  // ← Mayúscula
  const navigate = useNavigate()
  
  return (
    <div>
      <Topvar />
      <div className="p-6">
        <button 
          onClick={() => navigate('/')} 
          className="bg-gray-500 text-white px-4 py-2 rounded mb-4"
        >
          ← Volver al menú
        </button>
        <h1 className="text-2xl font-bold">Reporte de Platos</h1>
        <p>Aquí van los platos más vendidos...</p>
      </div>
    </div>
  )
}