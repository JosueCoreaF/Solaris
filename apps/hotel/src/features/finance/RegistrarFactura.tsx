import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Scan, CheckCircle, AlertCircle, X, FileText, RotateCcw, Plus, Trash2, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { useFinanceAI } from '../../context/FinanceAIContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ── Categorías ────────────────────────────────────────────────────────────────
export const CATEGORIAS_GENERALES = [
  { id: 1,  nombre: 'Sueldos y Salario' },
  { id: 2,  nombre: 'Horas Extras, Bonos y Cubrir dias Libres' },
  { id: 3,  nombre: '4% Turismo' },
  { id: 4,  nombre: '15% Impuesto S/Venta' },
  { id: 5,  nombre: 'Energia Electrica' },
  { id: 6,  nombre: 'Agua Potable' },
  { id: 7,  nombre: 'Telefono Hondutel' },
  { id: 8,  nombre: 'Cable' },
  { id: 9,  nombre: 'Internet Y telefonia de Pronto' },
  { id: 10, nombre: 'Papel Higienico' },
  { id: 11, nombre: 'Impuesto Municipales y Bienes y Muebles' },
  { id: 12, nombre: 'Impuestos Sobre La Renta P.N / P.J' },
  { id: 13, nombre: 'Servicios Contables' },
  { id: 14, nombre: 'Planilla de IHSS' },
  { id: 15, nombre: 'Comision a Booking y Expedia' },
  { id: 16, nombre: 'Membresia de correo' },
  { id: 17, nombre: 'Pago para constancia de pagos a cuenta' },
  { id: 18, nombre: 'Compra de agua en botesito' },
  { id: 19, nombre: 'Pago de Facebook' },
  { id: 20, nombre: 'Transporte y limpieza de hotel' },
  { id: 21, nombre: 'Jabon empacado, Cintas y Vasos Conicos' },
  { id: 22, nombre: 'Lavanderia (Detergente, Cloro, Aromatizante)' },
  { id: 23, nombre: 'Compra de medicina' },
  { id: 24, nombre: 'Mobiliario y Equipo y Papeleria Oficina' },
  { id: 25, nombre: 'Compra de toallas y utencilios' },
  { id: 26, nombre: 'Pago por reparacion y mantenimiento' },
  { id: 27, nombre: 'Instalacion y Equipos Especiales' },
  { id: 28, nombre: 'Pago de solvencia municipal' },
  { id: 29, nombre: 'Prestamo a Empleados' },
  { id: 30, nombre: 'Compra de baterias AA' },
  { id: 31, nombre: 'Otros gastos varios' },
  { id: 32, nombre: 'Gastos de Esther y Seguro Medico' },
  { id: 33, nombre: 'Prestaciones a empleados' },
];

export const CATEGORIAS_CAJA_CHICA = [
  { id: 1,  nombre: 'Leche' },
  { id: 2,  nombre: 'Jugos' },
  { id: 3,  nombre: 'Café' },
  { id: 4,  nombre: 'Cremora' },
  { id: 5,  nombre: 'Cereal' },
  { id: 6,  nombre: 'Azucar en Libras' },
  { id: 7,  nombre: 'Aceite de cocina' },
  { id: 8,  nombre: 'Pan molde' },
  { id: 9,  nombre: 'Pan dulce' },
  { id: 10, nombre: 'Tortilla de Harina, Tortillas Maiz, Baleadas' },
  { id: 11, nombre: 'Frijoles' },
  { id: 12, nombre: 'Embutidos' },
  { id: 13, nombre: 'Queso' },
  { id: 14, nombre: 'Huevos' },
  { id: 15, nombre: 'Agua en botellon' },
  { id: 16, nombre: 'Mantequilla' },
  { id: 17, nombre: 'Frutas' },
  { id: 18, nombre: 'Verduras' },
  { id: 19, nombre: 'Servilletas, Vasos fom, Platos, Tenedores' },
  { id: 20, nombre: 'Jaleas, yogurt' },
  { id: 21, nombre: 'Zukos o Tang' },
  { id: 22, nombre: 'Galletas, Donas, Arroz' },
  { id: 23, nombre: 'Confites, Harina para Hacer Panqueques' },
  { id: 24, nombre: 'Chile en bote y Lata, Miel, sal' },
  { id: 25, nombre: 'Otros' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FormState {
  fecha: string;
  proveedor: string;
  no_factura: string;
  rtn_proveedor: string;
  tipo: 'general' | 'caja_chica';
  categoria_general_id: string;
  categoria_chica_id: string;
  descripcion: string;
  subtotal: string;
  isv_15: string;
  isv_18: string;
  monto_total: string;
}

interface ItemDesglose {
  id: string;
  descripcion: string;
  categoria_id: string;
  monto: string;
}

interface ImagenState {
  file?: File;
  previewUrl?: string;
  base64?: string;
  mediaType?: string;
}



export type Paso = 'subir' | 'revisando' | 'formulario' | 'exito';

interface Props {
  onFacturaGuardada?: () => void;
  facturaAEditar?: any;
  onCancelarEdicion?: () => void;
}

export const RegistrarFactura: React.FC<Props> = ({
  onFacturaGuardada,
  facturaAEditar,
  onCancelarEdicion,
}) => {
  const {
    imagenes,
    setImagenes,
    lotes,
    setLotes,
    cargandoIA,
    estadoPasosIA,
    form,
    setForm,
    usarDesglose,
    setUsarDesglose,
    itemsDesglose,
    setItemsDesglose,
    paso,
    setPaso,
    escanearConIA,
    escanearLoteConIA,
    agregarImagen,
    fusionarLotes,
    desagruparLote,
    reiniciar,
    categoriasGenerales,
    categoriasCajaChica,
    agregarCategoriaGeneral,
    agregarCategoriaCajaChica,
  } = useFinanceAI();

  const [guardando, setGuardando] = useState(false);

  const [loteActivoId, setLoteActivoId] = useState<string | null>(null);

  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sesionGuardada, setSesionGuardada] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevenir cierre de pestaña o recarga accidental durante procesos activos
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cargandoIA || guardando) {
        e.preventDefault();
        e.returnValue = 'Hay un proceso contable activo (escaneo o guardado). Si sales o recargas, podrías perder los datos.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cargandoIA, guardando]);

  // Detectar sesión previa al montar (SOLO mostrar banner, no auto-restaurar)
  useEffect(() => {
    const guardado = localStorage.getItem('partnercentral_sesion_factura');
    if (guardado) {
      try {
        const parsed = JSON.parse(guardado);
        // Solo guardamos en estado local para mostrar el banner de restauración
        setSesionGuardada(parsed);
      } catch (e) {
        console.warn('Error al parsear sesión guardada:', e);
        localStorage.removeItem('partnercentral_sesion_factura');
      }
    }
  }, []);

  const limpiarCache = () => {
    localStorage.removeItem('partnercentral_sesion_factura');
    setSesionGuardada(null);
    reiniciar();
  };

  // Guardar sesión contable activa en localStorage
  useEffect(() => {
    if (paso === 'formulario') {
      const sesion = {
        form,
        usarDesglose,
        itemsDesglose,
        paso
      };
      localStorage.setItem('partnercentral_sesion_factura', JSON.stringify(sesion));
    } else if (paso === 'exito') {
      localStorage.removeItem('partnercentral_sesion_factura');
    }
  }, [form, usarDesglose, itemsDesglose, paso]);

  // Si estamos en el paso de revisar pero no quedan lotes (ej. se borraron las fotos),
  // redirigir automáticamente al paso de subir para evitar que la pantalla quede en blanco.
  useEffect(() => {
    if (paso === 'revisando' && lotes.length === 0) {
      setPaso('subir');
    }
  }, [lotes, paso, setPaso]);

  // Cargar datos de edición si existen
  useEffect(() => {
    if (facturaAEditar) {
      setForm({
        fecha: facturaAEditar.fecha || new Date().toLocaleDateString('en-CA'),
        proveedor: facturaAEditar.proveedor || '',
        no_factura: facturaAEditar.no_factura || '',
        rtn_proveedor: facturaAEditar.rtn_proveedor || '',
        tipo: facturaAEditar.tipo || 'general',
        categoria_general_id: facturaAEditar.categoria_general_id ? String(facturaAEditar.categoria_general_id) : '',
        categoria_chica_id: facturaAEditar.categoria_chica_id ? String(facturaAEditar.categoria_chica_id) : '',
        descripcion: facturaAEditar.descripcion || '',
        subtotal: facturaAEditar.subtotal != null ? String(facturaAEditar.subtotal) : '',
        isv_15: facturaAEditar.isv_15 != null ? String(facturaAEditar.isv_15) : '',
        isv_18: facturaAEditar.isv_18 != null ? String(facturaAEditar.isv_18) : '',
        monto_total: facturaAEditar.monto_total != null ? String(facturaAEditar.monto_total) : '',
      });

      if (facturaAEditar.imagen_url) {
        // Soporta múltiples URLs separadas por comas
        const urls = facturaAEditar.imagen_url.split(',').filter(Boolean);
        setImagenes(urls.map((url: string) => ({ previewUrl: url })));
      }

      if (Array.isArray(facturaAEditar.desglose) && facturaAEditar.desglose.length > 0) {
        setUsarDesglose(true);
        setItemsDesglose(
          facturaAEditar.desglose.map((item: any, idx: number) => ({
            id: String(idx + 1),
            descripcion: item.descripcion || '',
            categoria_id: String(item.categoria_id || ''),
            monto: String(item.monto || ''),
          }))
        );
      } else {
        setUsarDesglose(false);
        setItemsDesglose([]);
      }
      setPaso('formulario');
    }
  }, [facturaAEditar]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res((reader.result as string).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const procesarArchivo = useCallback(async (file: File) => {
    const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!TIPOS.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG, WEBP o PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera 10 MB.');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    agregarImagen({ file, previewUrl, base64, mediaType: file.type });
    setPaso('revisando');
    setError(null);
  }, [agregarImagen]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrandoArchivo(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await procesarArchivo(file);
    }
  }, [procesarArchivo]);

  // ── Llamada al backend → Gemini Vision (manejado por useFinanceAI globalmente) ───────────────────

  // El escaneo y guardado ya no suben imágenes a Supabase por petición del usuario

  // ── Guardar en backend → Supabase ──────────────────────────────────────────
  const guardarFactura = async () => {
    if (!form.proveedor || !form.monto_total) {
      setError('Proveedor y monto total son requeridos.');
      return;
    }

    const totalFacturaNum = parseFloat(form.monto_total);
    if (isNaN(totalFacturaNum)) {
      setError('El monto total debe ser un número válido.');
      return;
    }

    // Validar desglose
    let desgloseFinal: any[] = [];
    if (usarDesglose) {
      if (itemsDesglose.length === 0) {
        setError('Debes agregar al menos un ítem al desglose si la opción está activada.');
        return;
      }

      // Validar cada ítem
      for (const item of itemsDesglose) {
        if (!item.descripcion.trim()) {
          setError('Todos los ítems desglosados deben tener una descripción.');
          return;
        }
        if (!item.categoria_id) {
          setError('Todos los ítems desglosados deben tener una categoría asignada.');
          return;
        }
        const itemMonto = parseFloat(item.monto);
        if (isNaN(itemMonto) || itemMonto <= 0) {
          setError('El monto de todos los ítems debe ser mayor que 0.');
          return;
        }
      }

      const sumItems = itemsDesglose.reduce((sum, item) => sum + parseFloat(item.monto || '0'), 0);
      if (Math.abs(sumItems - totalFacturaNum) > 0.05) {
        setError(`La suma de los ítems desglosados (L ${sumItems.toFixed(2)}) debe coincidir exactamente con el Monto Total (L ${totalFacturaNum.toFixed(2)}).`);
        return;
      }

      desgloseFinal = itemsDesglose.map(item => ({
        descripcion: item.descripcion.trim(),
        categoria_id: Number(item.categoria_id),
        monto: parseFloat(item.monto),
      }));
    }

    setGuardando(true);
    setError(null);
    try {
      // No subir las fotos a Supabase por petición del usuario
      const imagen_url = null;
      
      const payload = {
        ...form,
        imagen_url,
        desglose: usarDesglose ? desgloseFinal : [],
      };

      const url = facturaAEditar 
        ? `${API_BASE}/finanzas/facturas/${facturaAEditar.id_factura}`
        : `${API_BASE}/finanzas/facturas`;
        
      const method = facturaAEditar ? 'PUT' : 'POST';

      // Adjuntar JWT y hotel ID para que el backend resuelva el contexto
      const token = (await import('../../api/supabase'))
        .supabase.auth.getSession()
        .then(r => r.data.session?.access_token || '')
        .catch(() => '');
      const activeHotelId = localStorage.getItem('active_hotel_id') || '';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Hotel-ID': activeHotelId,
          'Authorization': `Bearer ${await token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Error al guardar');
      
      // Si es parte de un lote
      if (loteActivoId) {
        setLotes(prev => prev.filter(l => l.id !== loteActivoId));
        const restLotes = lotes.filter(l => l.id !== loteActivoId);
        setLoteActivoId(null);

        if (restLotes.length > 0) {
          setPaso('revisando');
          alert(`¡Factura de "${form.proveedor}" registrada con éxito! Quedan ${restLotes.length} factura(s) pendiente(s) en tu lote.`);
        } else {
          setPaso('exito');
          onFacturaGuardada?.();
        }
      } else {
        setPaso('exito');
        onFacturaGuardada?.();
      }
    } catch (e: any) {
      setError(e.message || 'Error al guardar la factura');
    } finally {
      setGuardando(false);
    }
  };



  const set = (campo: keyof FormState, valor: string) =>
    setForm(prev => ({ ...prev, [campo]: valor }));

  const categoriasActuales = form.tipo === 'general' ? categoriasGenerales : categoriasCajaChica;

  const manejarSeleccionCategoria = (valor: string, esDesglose: boolean, itemId?: string) => {
    if (valor === 'CREAR_NUEVA') {
      const nombre = prompt('Ingresa el nombre de la nueva categoría:');
      if (nombre && nombre.trim()) {
        const nuevaCat = form.tipo === 'general' 
          ? agregarCategoriaGeneral(nombre.trim())
          : agregarCategoriaCajaChica(nombre.trim());
        
        if (esDesglose && itemId) {
          modificarItemDesglose(itemId, 'categoria_id', String(nuevaCat.id));
        } else {
          set(form.tipo === 'general' ? 'categoria_general_id' : 'categoria_chica_id', String(nuevaCat.id));
        }
      }
    } else {
      if (esDesglose && itemId) {
        modificarItemDesglose(itemId, 'categoria_id', valor);
      } else {
        set(form.tipo === 'general' ? 'categoria_general_id' : 'categoria_chica_id', valor);
      }
    }
  };

  // ── Gestión interactiva de desglose ─────────────────────────────────────────
  const agregarItemDesglose = () => {
    const nuevoItem: ItemDesglose = {
      id: String(Date.now()),
      descripcion: '',
      categoria_id: '',
      monto: '',
    };
    setItemsDesglose(prev => [...prev, nuevoItem]);
  };

  const modificarItemDesglose = (id: string, campo: keyof ItemDesglose, valor: string) => {
    setItemsDesglose(prev =>
      prev.map(item => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  const eliminarItemDesglose = (id: string) => {
    setItemsDesglose(prev => prev.filter(item => item.id !== id));
  };

  const totalDesglose = itemsDesglose.reduce((sum, item) => sum + parseFloat(item.monto || '0'), 0);
  const totalFacturaFloat = parseFloat(form.monto_total || '0');
  const desgloseCoincide = Math.abs(totalDesglose - totalFacturaFloat) < 0.05;

  // ── Indicador de pasos ──────────────────────────────────────────────────────
  const pasos = ['Subir', 'Revisar', 'Formulario'];
  const pasoIndex = paso === 'subir' ? 0 : paso === 'revisando' ? 1 : 2;

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      {/* Pasos (Ocultar si estamos editando) */}
      {paso !== 'exito' && !facturaAEditar && (
        <div className="flex items-center gap-2 mb-8">
          {pasos.map((p, i) => (
            <React.Fragment key={p}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    i < pasoIndex
                      ? 'bg-green-500 text-white'
                      : i === pasoIndex
                      ? 'bg-slate-800 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i < pasoIndex ? '✓' : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === pasoIndex ? 'text-slate-800' : 'text-gray-400'}`}>
                  {p}
                </span>
              </div>
              {i < pasos.length - 1 && (
                <div className={`flex-1 h-px ${i < pasoIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
          {/* Botón Limpiar caché — visible solo si hay residuos en localStorage */}
          {sesionGuardada && (
            <button
              type="button"
              onClick={limpiarCache}
              title="Eliminar sesión guardada en caché"
              className="ml-2 flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-full transition-all whitespace-nowrap"
            >
              <Trash2 size={10} /> Limpiar caché
            </button>
          )}
        </div>
      )}

      {/* Titulo si es Edición */}
      {facturaAEditar && paso !== 'exito' && (
        <div className="mb-6 flex justify-between items-center border-b border-gray-100 pb-4">
          <h2 className="text-xl font-semibold text-slate-800">Editar Factura</h2>
          <button
            onClick={onCancelarEdicion}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Error global */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Banner de restauración de sesión guardada */}
      {paso === 'subir' && sesionGuardada && (
        <div className="bg-gradient-to-r from-indigo-950 to-slate-900 text-white rounded-2xl p-5 mb-6 border border-indigo-900/50 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <span className="inline-block bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1">
              Sesión inconclusa detectada
            </span>
            <h4 className="font-semibold text-sm text-white">
              ¿Deseas restaurar tu factura anterior?
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Tienes datos ingresados previamente pendientes de registro.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setForm(sesionGuardada.form);
                setUsarDesglose(sesionGuardada.usarDesglose);
                setItemsDesglose(sesionGuardada.itemsDesglose);
                setPaso(sesionGuardada.paso);
                setSesionGuardada(null);
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              Restaurar
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('partnercentral_sesion_factura');
                setSesionGuardada(null);
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 1: Subir ─────────────────────────────────────────────────── */}
      {paso === 'subir' && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setArrastrandoArchivo(true); }}
          onDragLeave={() => setArrastrandoArchivo(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
            arrastrandoArchivo
              ? 'border-slate-400 bg-slate-50'
              : 'border-gray-200 hover:border-slate-300 hover:bg-gray-50'
          }`}
        >
          <Upload size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700 mb-1">
            Arrastra la factura aquí
          </p>
          <p className="text-sm text-gray-400 mb-2">o haz clic para seleccionar</p>
          <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-full py-1 px-3 inline-block">
            Soporta una o múltiples fotos enfocadas para capturar todo el detalle
          </p>
          <p className="text-[10px] text-gray-300 mt-3">JPG, PNG, WEBP, PDF · máx. 10 MB por archivo</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={async e => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                await procesarArchivo(file);
              }
            }}
          />
        </div>
      )}

      {/* ── PASO 2: Revisar imágenes ───────────────────────────────────────── */}
      {paso === 'revisando' && lotes.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Facturas Cargadas ({lotes.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Organiza tus fotos en grupos (facturas) y escanéalas de forma individual o en lote.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (cargandoIA || guardando) return;
                inputRef.current?.click();
              }}
              disabled={cargandoIA || guardando}
              className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} /> Añadir más fotos
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              disabled={cargandoIA || guardando}
              onChange={async e => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  await procesarArchivo(file);
                }
              }}
            />
          </div>

          {/* Listado de Lotes de Facturas */}
          <div className="space-y-4 mb-6">
            {lotes.map((lote, index) => (
              <div
                key={lote.id}
                className={`p-4 rounded-2xl border transition-all ${
                  lote.estado === 'escaneando'
                    ? 'border-indigo-200 bg-indigo-50/10 shadow-sm'
                    : lote.estado === 'completado'
                    ? 'border-emerald-200 bg-emerald-50/5'
                    : lote.estado === 'error'
                    ? 'border-red-200 bg-red-50/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Cabecera del Lote */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-700">
                      {lote.nombre}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      ({lote.imagenes.length} {lote.imagenes.length === 1 ? 'foto' : 'fotos'})
                    </span>
                  </div>

                  {/* Estado del Lote */}
                  <div>
                    {lote.estado === 'pendiente' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Pendiente
                      </span>
                    )}
                    {lote.estado === 'escaneando' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 animate-pulse flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Escaneando con IA
                      </span>
                    )}
                    {lote.estado === 'completado' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                        ✓ Escaneada con IA
                      </span>
                    )}
                    {lote.estado === 'error' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">
                        ⚠️ Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid de miniaturas del Lote */}
                <div className="flex flex-wrap gap-2.5">
                  {lote.imagenes.map((img, imgIdx) => (
                    <div
                      key={imgIdx}
                      className="group relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shadow-xs"
                    >
                      {img.mediaType === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center p-2 text-slate-400">
                          <FileText size={20} className="text-slate-400" />
                          <span className="text-[8px] max-w-full truncate text-slate-500 font-medium mt-0.5 px-0.5">
                            PDF
                          </span>
                        </div>
                      ) : (
                        <img
                          src={img.previewUrl}
                          alt="Previsualización"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Botón de eliminar foto individual dentro de este Lote */}
                      <button
                        type="button"
                        disabled={cargandoIA || guardando}
                        onClick={() => {
                          if (cargandoIA || guardando) return;
                          setLotes(prev =>
                            prev
                              .map(l => {
                                if (l.id === lote.id) {
                                  const restImgs = l.imagenes.filter((_, idx) => idx !== imgIdx);
                                  return {
                                    ...l,
                                    imagenes: restImgs,
                                    estado: 'pendiente' as const,
                                    progreso: 'Pendiente de escaneo',
                                  };
                                }
                                return l;
                              })
                              .filter(l => l.imagenes.length > 0)
                          );
                        }}
                        className="absolute inset-0 bg-red-950/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl animate-fade-in"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Datos ya escaneados (Vista rápida para verificar) */}
                {lote.estado === 'completado' && lote.datosExtraidos && (
                  <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <strong className="text-slate-700">Proveedor:</strong>
                        <p className="truncate font-semibold text-slate-800">{lote.datosExtraidos.proveedor || 'N/D'}</p>
                      </div>
                      <div>
                        <strong className="text-slate-700">Factura #:</strong>
                        <p className="truncate font-semibold text-slate-800">{lote.datosExtraidos.no_factura || 'N/D'}</p>
                      </div>
                      <div>
                        <strong className="text-slate-700">Fecha:</strong>
                        <p className="font-semibold text-slate-800">{lote.datosExtraidos.fecha || 'N/D'}</p>
                      </div>
                      <div>
                        <strong className="text-slate-700">Total:</strong>
                        <p className="font-bold text-indigo-600">L {parseFloat(lote.datosExtraidos.monto_total || '0').toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mostrar error si falló */}
                {lote.estado === 'error' && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50/50 p-2.5 rounded-xl border border-red-100 flex items-start gap-1.5">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{lote.error || 'Error al conectar con la API.'}</span>
                  </div>
                )}

                {/* Acciones del Lote */}
                <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                  {/* Fusión con otra factura */}
                  {lotes.length > 1 && index > 0 && (
                    <button
                      type="button"
                      disabled={cargandoIA || guardando}
                      onClick={() => fusionarLotes(lote.id, lotes[index - 1].id)}
                      className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-slate-100 transition-all font-medium"
                    >
                      Fusionar con anterior
                    </button>
                  )}

                  {/* Desagrupar si tiene múltiples imágenes */}
                  {lote.imagenes.length > 1 && (
                    <button
                      type="button"
                      disabled={cargandoIA || guardando}
                      onClick={() => desagruparLote(lote.id)}
                      className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-slate-100 transition-all font-medium"
                    >
                      Desagrupar fotos
                    </button>
                  )}

                  {/* Escaneo individual */}
                  {(lote.estado === 'pendiente' || lote.estado === 'error') && (
                    <button
                      type="button"
                      disabled={cargandoIA || guardando}
                      onClick={() => escanearLoteConIA(lote.id)}
                      className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Sparkles size={12} /> Escanear con IA
                    </button>
                  )}

                  {/* Revisar y guardar */}
                  {lote.estado === 'completado' && (
                    <button
                      type="button"
                      disabled={cargandoIA || guardando}
                      onClick={() => {
                        setLoteActivoId(lote.id);
                        const d = lote.datosExtraidos;
                        setForm({
                          fecha: d.fecha,
                          proveedor: d.proveedor,
                          no_factura: d.no_factura,
                          rtn_proveedor: d.rtn_proveedor,
                          tipo: d.tipo,
                          categoria_general_id: '',
                          categoria_chica_id: '',
                          descripcion: d.descripcion || '',
                          subtotal: d.subtotal || '0',
                          isv_15: d.isv_15 || '0',
                          isv_18: d.isv_18 || '0',
                          monto_total: d.monto_total || '0',
                        });
                        setUsarDesglose(Array.isArray(d.desglose) && d.desglose.length > 0);
                        setItemsDesglose(Array.isArray(d.desglose) ? d.desglose : []);
                        setPaso('formulario');
                        setError(null);
                      }}
                      className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all shadow-xs"
                    >
                      Revisar y Registrar <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Acciones Globales del Lote */}
          <div className="flex flex-col gap-3">
            {lotes.some(l => l.estado === 'pendiente' || l.estado === 'error') && (
              <button
                onClick={escanearConIA}
                disabled={cargandoIA}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 disabled:opacity-60 transition-all shadow-sm animate-pulse-subtle"
              >
                {cargandoIA ? (
                  <>
                    <Loader2 size={16} className="animate-spin flex-shrink-0" />
                    <span className="text-[12px] truncate px-1 animate-pulse">
                      {estadoPasosIA || 'Escaneando facturas pendientes...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Scan size={18} />
                    Escanear Todas las Pendientes con IA
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                setLoteActivoId(null);
                setForm({
                  fecha: new Date().toLocaleDateString('en-CA'),
                  proveedor: '',
                  no_factura: '',
                  rtn_proveedor: '',
                  tipo: 'general',
                  categoria_general_id: '',
                  categoria_chica_id: '',
                  descripcion: '',
                  subtotal: '0',
                  isv_15: '0',
                  isv_18: '0',
                  monto_total: '0',
                });
                setUsarDesglose(false);
                setItemsDesglose([]);
                setPaso('formulario');
                setError(null);
              }}
              disabled={cargandoIA}
              className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Ingresar datos manualmente
            </button>
            <button onClick={reiniciar} className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2 py-1">
              Limpiar y empezar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Formulario ────────────────────────────────────────────── */}
      {paso === 'formulario' && (
        <div>
          {/* Barra de progreso de Lote (Carga Masiva) */}
          {loteActivoId && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 mb-6 border border-slate-800 shadow-lg flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Modo Registro Activo (Lote)
                  </span>
                  <p className="text-xs font-semibold text-slate-200">
                    Revisando: {lotes.find(l => l.id === loteActivoId)?.nombre || 'Factura'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaso('revisando');
                  setLoteActivoId(null);
                }}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                Volver a Lotes
              </button>
            </div>
          )}

          {/* Miniatura de la imagen cargada */}
          {(() => {
            const imgsAMostrar = loteActivoId
              ? lotes.find(l => l.id === loteActivoId)?.imagenes || []
              : imagenes;

            if (imgsAMostrar.length === 0) return null;
            return (
              <div className="bg-indigo-50/50 rounded-2xl p-4 mb-6 border border-indigo-100/50">
                <span className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">
                  Imágenes de referencia para esta factura ({imgsAMostrar.length})
                </span>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {imgsAMostrar.map((img: ImagenState, idx: number) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-indigo-100 w-16 h-16 flex-shrink-0 bg-white shadow-sm group cursor-pointer"
                      onClick={() => {
                        if (img.previewUrl) window.open(img.previewUrl, '_blank');
                      }}
                      title="Ver imagen en pantalla completa"
                    >
                      {img.mediaType === 'application/pdf' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <FileText size={18} />
                          <span className="text-[7px] truncate max-w-full px-1">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={img.previewUrl}
                          alt=""
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all"
                        />
                      )}
                      <div className="absolute bottom-0 right-0 bg-slate-800/90 text-white text-[8px] font-bold px-1 rounded-tl">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-indigo-400 mt-2">
                  💡 Haz clic sobre una imagen para verla en pantalla completa o enfocar detalles.
                </p>
              </div>
            );
          })()}

          <div className="flex flex-col gap-4">
            {/* Tipo de factura */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Tipo de gasto
              </label>
              <div className="flex gap-2">
                {(['general', 'caja_chica'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      set('tipo', t);
                      set('categoria_general_id', '');
                      set('categoria_chica_id', '');
                      // Reset split item categories when toggling main expense type
                      setItemsDesglose(prev => prev.map(item => ({ ...item, categoria_id: '' })));
                    }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      form.tipo === t
                        ? 'bg-slate-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'general' ? 'Gastos Generales' : 'Caja Chica'}
                  </button>
                ))}
              </div>
            </div>

            {/* Fila: fecha + no. factura */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => set('fecha', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">No. Factura</label>
                <input
                  type="text"
                  placeholder="012-002-01-00000000"
                  value={form.no_factura}
                  onChange={e => set('no_factura', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {/* Proveedor */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor *</label>
              <input
                type="text"
                placeholder="Nombre del negocio"
                value={form.proveedor}
                onChange={e => set('proveedor', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
              />
            </div>

            {/* RTN */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RTN del Proveedor</label>
              <input
                type="text"
                placeholder="0000-0000-000000"
                value={form.rtn_proveedor}
                onChange={e => set('rtn_proveedor', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
              />
            </div>

            {/* Categoría (solo si no se está desglosando) */}
            {!usarDesglose && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoría Única *</label>
                <select
                  value={form.tipo === 'general' ? form.categoria_general_id : form.categoria_chica_id}
                  onChange={e => manejarSeleccionCategoria(e.target.value, false)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400 bg-white font-medium"
                >
                  <option value="">— Seleccionar categoría —</option>
                  {categoriasActuales.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                  ))}
                  <option value="CREAR_NUEVA" className="text-indigo-600 font-bold bg-indigo-50/50">+ Crear nueva categoría...</option>
                </select>
              </div>
            )}

            {/* Descripción (solo si no se está desglosando) */}
            {!usarDesglose && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Artículos o servicios comprados"
                  value={form.descripcion}
                  maxLength={120}
                  onChange={e => set('descripcion', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
            )}

            {/* Montos principales */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal (L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.subtotal}
                  onChange={e => set('subtotal', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  ISV 15% (L)
                  <span className="ml-1 bg-yellow-200 text-yellow-800 text-xxs px-1 rounded">destacar</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.isv_15}
                  onChange={e => set('isv_15', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400 bg-yellow-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ISV 18% (L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.isv_18}
                  onChange={e => set('isv_18', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {/* Monto Total */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monto Total Factura (L) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.monto_total}
                onChange={e => set('monto_total', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-lg font-bold text-slate-800 focus:outline-none focus:border-slate-500"
              />
            </div>

            {/* 🔗 SECCIÓN: DESGLOSE DE GASTOS (SPLIT ITEMS) */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Desglosar en Múltiples Categorías</h3>
                  <p className="text-xxs text-gray-500">Usa esto si compraste cosas de Cocina, Mantenimiento y Lavandería en la misma factura.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usarDesglose}
                    onChange={e => {
                      setUsarDesglose(e.target.checked);
                      if (e.target.checked && itemsDesglose.length === 0) {
                        agregarItemDesglose();
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:r-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800 rounded-full" />
                </label>
              </div>

              {usarDesglose && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1 border-b border-gray-200 pb-1">
                    Líneas de Desglose
                  </div>
                  
                  {itemsDesglose.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative">
                      <span className="text-xs font-bold text-slate-400">{index + 1}</span>
                      
                      {/* Descripción */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Descripción del ítem (ej. Verduras)"
                          value={item.descripcion}
                          onChange={e => modificarItemDesglose(item.id, 'descripcion', e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
                        />
                      </div>

                      {/* Categoría */}
                      <div className="w-48">
                        <select
                          value={item.categoria_id}
                          onChange={e => manejarSeleccionCategoria(e.target.value, true, item.id)}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400 bg-white font-medium"
                        >
                          <option value="">— Categoría —</option>
                          {categoriasActuales.map(c => (
                            <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                          ))}
                          <option value="CREAR_NUEVA" className="text-indigo-600 font-bold bg-indigo-50/50">+ Crear nueva categoría...</option>
                        </select>
                      </div>

                      {/* Monto del Item */}
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.monto}
                          onChange={e => modificarItemDesglose(item.id, 'monto', e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-right font-medium focus:outline-none focus:border-slate-400"
                        />
                      </div>

                      {/* Eliminar Item */}
                      <button
                        type="button"
                        onClick={() => eliminarItemDesglose(item.id)}
                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  {/* Fila inferior: Agregar + Validador */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={agregarItemDesglose}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-all shadow-sm"
                    >
                      <Plus size={14} /> Agregar Línea
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Suma desglose: <strong className={desgloseCoincide ? "text-green-600" : "text-amber-600"}>L {totalDesglose.toFixed(2)}</strong>
                      </span>
                      {desgloseCoincide ? (
                        <span className="flex items-center gap-1 text-xxs font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                          ✓ Coincide perfectamente
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xxs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 animate-pulse">
                          ⚠ Faltan L {(totalFacturaFloat - totalDesglose).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botones de acción final */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={guardarFactura}
                disabled={guardando || (usarDesglose && !desgloseCoincide)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-medium text-sm transition-all ${
                  usarDesglose && !desgloseCoincide
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 active:scale-[0.99] disabled:opacity-60'
                }`}
              >
                {guardando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registrando factura...</span>
                  </>
                ) : (
                  facturaAEditar ? 'Guardar Cambios' : 'Registrar Factura'
                )}
              </button>
              
              {!facturaAEditar ? (
                <button
                  type="button"
                  onClick={() => setPaso('revisando')}
                  disabled={guardando}
                  className="px-4 py-3 border border-gray-200 text-gray-500 hover:text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-all"
                >
                  <RotateCcw size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancelarEdicion}
                  disabled={guardando}
                  className="px-4 py-3 border border-gray-200 text-gray-500 hover:text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ÉXITO ────────────────────────────────────────────────────────── */}
      {paso === 'exito' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {facturaAEditar ? '¡Factura actualizada!' : '¡Factura registrada!'}
          </h3>
          <p className="text-gray-400 text-sm mb-8">
            {form.proveedor && `${form.proveedor} — `}
            L {parseFloat(form.monto_total || '0').toLocaleString('es-HN', { minimumFractionDigits: 2 })}
          </p>
          <button
            onClick={() => {
              if (facturaAEditar && onCancelarEdicion) {
                onCancelarEdicion();
              } else {
                reiniciar();
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-all"
          >
            {facturaAEditar ? 'Volver al historial' : <><Upload size={16} /> Registrar otra factura</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrarFactura;
