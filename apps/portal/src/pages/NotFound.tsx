import { Link } from 'react-router-dom';
import { Hotel } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
        <Hotel size={26} className="text-slate-300" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Portal no encontrado</h1>
      <p className="text-slate-500 text-sm max-w-xs">
        El enlace que usaste no corresponde a ningún hotel registrado en Solarys.
      </p>
      <Link to="/" className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
        Ir al inicio
      </Link>
    </div>
  );
}
