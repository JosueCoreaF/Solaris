import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sparkles, Check, ChevronRight, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export interface ImagenState {
  file?: File;
  previewUrl: string;
  base64?: string;
  mediaType?: string;
}

export interface FormState {
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

export const FORM_INICIAL: FormState = {
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
};

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

export interface LoteEscaneo {
  id: string;
  nombre: string;
  imagenes: ImagenState[];
  estado: 'pendiente' | 'escaneando' | 'completado' | 'error';
  progreso: string;
  error?: string | null;
  datosExtraidos?: any;
}

interface FinanceAIContextType {
  imagenes: ImagenState[];
  setImagenes: React.Dispatch<React.SetStateAction<ImagenState[]>>;
  lotes: LoteEscaneo[];
  setLotes: React.Dispatch<React.SetStateAction<LoteEscaneo[]>>;
  cargandoIA: boolean;
  setCargandoIA: (val: boolean) => void;
  estadoPasosIA: string;
  setEstadoPasosIA: (val: string) => void;
  errorIA: string | null;
  setErrorIA: (val: string | null) => void;
  facturasLote: any[];
  setFacturasLote: React.Dispatch<React.SetStateAction<any[]>>;
  indiceActivoLote: number;
  setIndiceActivoLote: (val: number) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  usarDesglose: boolean;
  setUsarDesglose: (val: boolean) => void;
  itemsDesglose: any[];
  setItemsDesglose: React.Dispatch<React.SetStateAction<any[]>>;
  paso: string;
  setPaso: (val: string) => void;
  guardando: boolean;
  setGuardando: (val: boolean) => void;
  progresoSubida: string;
  setProgresoSubida: (val: string) => void;
  escanearConIA: () => Promise<void>;
  escanearLoteConIA: (loteId: string) => Promise<void>;
  agregarImagen: (img: ImagenState) => void;
  fusionarLotes: (idOrigen: string, idDestino: string) => void;
  desagruparLote: (loteId: string) => void;
  reiniciar: () => void;
  categoriasGenerales: any[];
  categoriasCajaChica: any[];
  agregarCategoriaGeneral: (nombre: string) => any;
  agregarCategoriaCajaChica: (nombre: string) => any;
}

const FinanceAIContext = createContext<FinanceAIContextType | undefined>(undefined);

export const FinanceAIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [imagenes, setImagenes] = useState<ImagenState[]>([]);
  const [lotes, setLotes] = useState<LoteEscaneo[]>([]);
  const [cargandoIA, setCargandoIA] = useState<boolean>(false);
  const [estadoPasosIA, setEstadoPasosIA] = useState<string>('');
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [facturasLote, setFacturasLote] = useState<any[]>([]);
  const [indiceActivoLote, setIndiceActivoLote] = useState<number>(0);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [usarDesglose, setUsarDesglose] = useState<boolean>(false);
  const [itemsDesglose, setItemsDesglose] = useState<any[]>([]);
  const [paso, setPaso] = useState<string>('subir');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [progresoSubida, setProgresoSubida] = useState<string>('');
  const [completadoRecientemente, setCompletadoRecientemente] = useState<boolean>(false);

  // Estados para categorías dinámicas personalizadas creadas por el usuario
  const [customCategoriasGenerales, setCustomCategoriasGenerales] = useState<any[]>(() => {
    const saved = localStorage.getItem('partnercentral_custom_categorias_generales');
    return saved ? JSON.parse(saved) : [];
  });
  const [customCategoriasCajaChica, setCustomCategoriasCajaChica] = useState<any[]>(() => {
    const saved = localStorage.getItem('partnercentral_custom_categorias_caja_chica');
    return saved ? JSON.parse(saved) : [];
  });

  const agregarCategoriaGeneral = (nombre: string) => {
    // Para no chocar con los IDs estáticos que son del 1 al 33
    const nueva = { id: 100 + customCategoriasGenerales.length, nombre };
    setCustomCategoriasGenerales(prev => {
      const next = [...prev, nueva];
      localStorage.setItem('partnercentral_custom_categorias_generales', JSON.stringify(next));
      return next;
    });
    return nueva;
  };

  const agregarCategoriaCajaChica = (nombre: string) => {
    // Para no chocar con los IDs estáticos que son del 1 al 25
    const nueva = { id: 100 + customCategoriasCajaChica.length, nombre };
    setCustomCategoriasCajaChica(prev => {
      const next = [...prev, nueva];
      localStorage.setItem('partnercentral_custom_categorias_caja_chica', JSON.stringify(next));
      return next;
    });
    return nueva;
  };

  const categoriasGenerales = [...CATEGORIAS_GENERALES, ...customCategoriasGenerales];
  const categoriasCajaChica = [...CATEGORIAS_CAJA_CHICA, ...customCategoriasCajaChica];

  // Cargar lotes y paso desde localStorage al montar el componente
  useEffect(() => {
    const lotesGuardados = localStorage.getItem('partnercentral_lotes_factura');
    const pasoGuardado = localStorage.getItem('partnercentral_paso_factura');
    
    if (lotesGuardados) {
      try {
        const parsed = JSON.parse(lotesGuardados);
        if (Array.isArray(parsed)) {
          // Reconstruir previewUrls a partir del base64 para que sobrevivan a recargas de página
          const lotesRestaurados = parsed.map((l: any) => ({
            ...l,
            imagenes: (l.imagenes || []).map((img: any) => ({
              ...img,
              previewUrl: img.base64 ? `data:${img.mediaType};base64,${img.base64}` : img.previewUrl
            }))
          }));
          setLotes(lotesRestaurados);
          
          // Inicializar también la lista plana de imágenes
          const imgsPlanas: ImagenState[] = [];
          lotesRestaurados.forEach(l => {
            imgsPlanas.push(...l.imagenes);
          });
          setImagenes(imgsPlanas);
        }
      } catch (e) {
        console.warn('Error al restaurar lotes de localStorage:', e);
      }
    }
    
    if (pasoGuardado) {
      setPaso(pasoGuardado);
    }
  }, []);

  // Guardar lotes en localStorage cuando cambien
  useEffect(() => {
    if (lotes.length > 0) {
      // Excluir la propiedad 'file' (no serializable) para evitar saturar localStorage
      const lotesLimpios = lotes.map(l => ({
        ...l,
        imagenes: l.imagenes.map(img => ({
          previewUrl: img.previewUrl,
          base64: img.base64,
          mediaType: img.mediaType
        }))
      }));
      localStorage.setItem('partnercentral_lotes_factura', JSON.stringify(lotesLimpios));
    } else {
      localStorage.removeItem('partnercentral_lotes_factura');
    }
  }, [lotes]);

  // Guardar paso en localStorage
  useEffect(() => {
    if (paso) {
      localStorage.setItem('partnercentral_paso_factura', paso);
    }
  }, [paso]);

  const reiniciar = () => {
    setForm(FORM_INICIAL);
    setImagenes([]);
    setLotes([]);
    setUsarDesglose(false);
    setItemsDesglose([]);
    setFacturasLote([]);
    setIndiceActivoLote(0);
    setPaso('subir');
    setErrorIA(null);
    setCompletadoRecientemente(false);
    localStorage.removeItem('partnercentral_sesion_factura');
    localStorage.removeItem('partnercentral_lotes_factura');
    localStorage.removeItem('partnercentral_paso_factura');
  };

  const agregarImagen = (img: ImagenState) => {
    setImagenes(prev => [...prev, img]);
    setLotes(prev => {
      const idx = prev.length + 1;
      return [
        ...prev,
        {
          id: `lote-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          nombre: `Factura #${idx}`,
          imagenes: [img],
          estado: 'pendiente',
          progreso: 'Pendiente de escaneo',
        }
      ];
    });
  };

  const fusionarLotes = (idOrigen: string, idDestino: string) => {
    setLotes(prev => {
      const origen = prev.find(l => l.id === idOrigen);
      const destino = prev.find(l => l.id === idDestino);
      if (!origen || !destino) return prev;

      return prev
        .map(l => {
          if (l.id === idDestino) {
            return {
              ...l,
              imagenes: [...l.imagenes, ...origen.imagenes],
              estado: l.estado === 'completado' && origen.estado === 'completado' ? 'completado' : 'pendiente',
              progreso: l.estado === 'completado' && origen.estado === 'completado' ? 'Listo' : 'Pendiente de escaneo',
            } as LoteEscaneo;
          }
          return l;
        })
        .filter(l => l.id !== idOrigen)
        .map((l, idx) => ({
          ...l,
          nombre: `Factura #${idx + 1}`
        }));
    });
  };

  const desagruparLote = (loteId: string) => {
    setLotes(prev => {
      const lote = prev.find(l => l.id === loteId);
      if (!lote || lote.imagenes.length <= 1) return prev;

      const nuevosLotes = lote.imagenes.slice(1).map((img, idx) => ({
        id: `lote-split-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
        nombre: `Factura Aux`,
        imagenes: [img],
        estado: 'pendiente' as const,
        progreso: 'Pendiente de escaneo',
      }));

      return prev
        .map(l => {
          if (l.id === loteId) {
            return {
              ...l,
              imagenes: [l.imagenes[0]],
              estado: 'pendiente' as const,
              progreso: 'Pendiente de escaneo',
            } as LoteEscaneo;
          }
          return l;
        })
        .concat(nuevosLotes)
        .map((l, idx) => ({
          ...l,
          nombre: `Factura #${idx + 1}`
        }));
    });
  };

  const escanearLoteConIA = async (loteId: string) => {
    setLotes(prev =>
      prev.map(l =>
        l.id === loteId
          ? { ...l, estado: 'escaneando', progreso: 'Analizando imágenes...' }
          : l
      )
    );

    try {
      // Obtener el lote con sus datos actuales
      let loteObj = lotes.find(l => l.id === loteId);
      if (!loteObj) return;

      const imgsPayload = loteObj.imagenes
        .map(img => ({
          imageBase64: img.base64,
          mediaType: img.mediaType,
        }))
        .filter(img => img.imageBase64 && img.mediaType);

      setLotes(prev =>
        prev.map(l =>
          l.id === loteId
            ? { ...l, progreso: 'Enviando a Inteligencia Artificial...' }
            : l
        )
      );

      const resp = await fetch(`${API_BASE}/finanzas/escanear-factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagenes: imgsPayload,
          categoriasGenerales: categoriasGenerales,
          categoriasCajaChica: categoriasCajaChica,
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || 'Error al escanear factura');
      }

      const d = json.datos;
      let datosFactura: any = null;

      if (Array.isArray(d.facturas) && d.facturas.length > 0) {
        const fac = d.facturas[0];
        datosFactura = {
          proveedor: fac.proveedor || '',
          no_factura: fac.no_factura || '',
          rtn_proveedor: fac.rtn_proveedor || '',
          fecha: fac.fecha || new Date().toLocaleDateString('en-CA'),
          descripcion: fac.descripcion || '',
          subtotal: fac.subtotal != null ? String(fac.subtotal) : '0',
          isv_15: fac.isv_15 != null ? String(fac.isv_15) : '0',
          isv_18: fac.isv_18 != null ? String(fac.isv_18) : '0',
          monto_total: fac.monto_total != null ? String(fac.monto_total) : '0',
          tipo: fac.tipo === 'caja_chica' ? 'caja_chica' : 'general',
          desglose: Array.isArray(fac.desglose)
            ? fac.desglose.map((item: any, itemIdx: number) => ({
                id: String(itemIdx + 1),
                descripcion: item.descripcion || '',
                categoria_id: item.categoria_id ? String(item.categoria_id) : '',
                monto: item.monto != null ? String(item.monto) : '0',
              }))
            : [],
        };
      } else {
        datosFactura = {
          proveedor: d.proveedor || '',
          no_factura: d.no_factura || '',
          rtn_proveedor: d.rtn_proveedor || '',
          fecha: d.fecha || new Date().toLocaleDateString('en-CA'),
          descripcion: d.descripcion || '',
          subtotal: d.subtotal != null ? String(d.subtotal) : '0',
          isv_15: d.isv_15 != null ? String(d.isv_15) : '0',
          isv_18: d.isv_18 != null ? String(d.isv_18) : '0',
          monto_total: d.monto_total != null ? String(d.monto_total) : '0',
          tipo: d.tipo === 'caja_chica' ? 'caja_chica' : 'general',
          desglose: Array.isArray(d.desglose)
            ? d.desglose.map((item: any, idx: number) => ({
                id: String(idx + 1),
                descripcion: item.descripcion || '',
                categoria_id: item.categoria_id ? String(item.categoria_id) : '',
                monto: item.monto != null ? String(item.monto) : '0',
              }))
            : [],
        };
      }

      setLotes(prev =>
        prev.map(l =>
          l.id === loteId
            ? {
                ...l,
                estado: 'completado',
                progreso: 'Listo para registrar',
                datosExtraidos: datosFactura,
                error: null,
              }
            : l
        )
      );
    } catch (e: any) {
      setLotes(prev =>
        prev.map(l =>
          l.id === loteId
            ? {
                ...l,
                estado: 'error',
                progreso: 'Error al escanear',
                error: e.message || 'Error de API',
              }
            : l
        )
      );
    }
  };

  const escanearConIA = async () => {
    const pendientes = lotes.filter(l => l.estado === 'pendiente' || l.estado === 'error');
    if (pendientes.length === 0) return;

    setCargandoIA(true);
    setErrorIA(null);
    setCompletadoRecientemente(false);

    // Marcar todos los lotes pendientes como escaneando
    setLotes(prev =>
      prev.map(l =>
        l.estado === 'pendiente' || l.estado === 'error'
          ? { ...l, estado: 'escaneando', progreso: 'Agrupando y analizando con IA...' }
          : l
      )
    );

    try {
      // 1. Aplanar las imágenes de todos los lotes pendientes
      const todasLasImagenes: ImagenState[] = [];
      pendientes.forEach(lote => {
        todasLasImagenes.push(...lote.imagenes);
      });

      const imgsPayload = todasLasImagenes
        .map(img => ({
          imageBase64: img.base64,
          mediaType: img.mediaType,
        }))
        .filter(img => img.imageBase64 && img.mediaType);

      if (imgsPayload.length === 0) {
        throw new Error('No hay imágenes válidas para escanear.');
      }

      setEstadoPasosIA(`Analizando y agrupando ${todasLasImagenes.length} fotos...`);

      // 2. Enviar todas las imágenes juntas al backend para que la IA las agrupe
      const resp = await fetch(`${API_BASE}/finanzas/escanear-factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagenes: imgsPayload,
          categoriasGenerales: categoriasGenerales,
          categoriasCajaChica: categoriasCajaChica,
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || 'Error al agrupar y escanear facturas');
      }

      const d = json.datos;
      const facturasExtraidas = Array.isArray(d.facturas) ? d.facturas : [];

      if (facturasExtraidas.length === 0) {
        throw new Error('La IA no identificó ninguna factura en las imágenes provistas.');
      }

      // 3. Crear los nuevos lotes agrupados basados en la respuesta de la IA
      const nuevosLotesAgrupados: LoteEscaneo[] = facturasExtraidas.map((fac: any, index: number) => {
        // Mapear los índices de imágenes devueltos por la IA a nuestras imágenes planas originales
        const indices = Array.isArray(fac.indices_imagenes) ? fac.indices_imagenes : [index];
        const imagenesDelLote = indices
          .map((idx: number) => todasLasImagenes[idx])
          .filter(Boolean);

        // Si por alguna razón no tiene imágenes, usar la que corresponde al índice actual
        const imagenesFinales = imagenesDelLote.length > 0 
          ? imagenesDelLote 
          : [todasLasImagenes[index] || todasLasImagenes[0]];

        const datosFactura = {
          proveedor: fac.proveedor || '',
          no_factura: fac.no_factura || '',
          rtn_proveedor: fac.rtn_proveedor || '',
          fecha: fac.fecha || new Date().toLocaleDateString('en-CA'),
          descripcion: fac.descripcion || '',
          subtotal: fac.subtotal != null ? String(fac.subtotal) : '0',
          isv_15: fac.isv_15 != null ? String(fac.isv_15) : '0',
          isv_18: fac.isv_18 != null ? String(fac.isv_18) : '0',
          monto_total: fac.monto_total != null ? String(fac.monto_total) : '0',
          tipo: fac.tipo === 'caja_chica' ? 'caja_chica' : 'general',
          desglose: Array.isArray(fac.desglose)
            ? fac.desglose.map((item: any, itemIdx: number) => ({
                id: String(itemIdx + 1),
                descripcion: item.descripcion || '',
                categoria_id: item.categoria_id ? String(item.categoria_id) : '',
                monto: item.monto != null ? String(item.monto) : '0',
              }))
            : [],
        };

        return {
          id: `lote-ia-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          nombre: `Factura #${index + 1} (${datosFactura.proveedor || 'Sin Nombre'})`,
          imagenes: imagenesFinales,
          estado: 'completado' as const,
          progreso: 'Listo para registrar',
          datosExtraidos: datosFactura,
          error: null,
        };
      });

      // 4. Reemplazar lotes pendientes con los nuevos lotes agrupados e inteligentes
      setLotes(prev => {
        const completadosAnteriormente = prev.filter(l => l.estado === 'completado');
        const combinados = [...completadosAnteriormente, ...nuevosLotesAgrupados];
        return combinados.map((l, idx) => ({
          ...l,
          nombre: `Factura #${idx + 1} ${l.datosExtraidos?.proveedor ? `(${l.datosExtraidos.proveedor})` : ''}`.trim()
        }));
      });

      setCompletadoRecientemente(true);
    } catch (e: any) {
      console.error('Error en escaneo agrupado por IA:', e);
      setErrorIA(e.message || 'Error al agrupar y escanear facturas con IA');
      
      // Revertir estados a error
      setLotes(prev =>
        prev.map(l =>
          l.estado === 'escaneando'
            ? { ...l, estado: 'error', progreso: 'Error al escanear', error: e.message || 'Error de API' }
            : l
        )
      );
    } finally {
      setCargandoIA(false);
      setEstadoPasosIA('');
    }
  };

  const deLotesCargando = lotes.some(l => l.estado === 'escaneando');
  const esCargandoIA = cargandoIA || deLotesCargando;

  return (
    <FinanceAIContext.Provider
      value={{
        imagenes,
        setImagenes,
        lotes,
        setLotes,
        cargandoIA: esCargandoIA,
        setCargandoIA,
        estadoPasosIA,
        setEstadoPasosIA,
        errorIA,
        setErrorIA,
        facturasLote,
        setFacturasLote,
        indiceActivoLote,
        setIndiceActivoLote,
        form,
        setForm,
        usarDesglose,
        setUsarDesglose,
        itemsDesglose,
        setItemsDesglose,
        paso,
        setPaso,
        guardando,
        setGuardando,
        progresoSubida,
        setProgresoSubida,
        escanearConIA,
        escanearLoteConIA,
        agregarImagen,
        fusionarLotes,
        desagruparLote,
        reiniciar,
        completadoRecientemente,
        setCompletadoRecientemente,
        categoriasGenerales,
        categoriasCajaChica,
        agregarCategoriaGeneral,
        agregarCategoriaCajaChica,
      }}
    >
      {children}
    </FinanceAIContext.Provider>
  );
};

export const useFinanceAI = () => {
  const context = useContext(FinanceAIContext);
  if (!context) {
    throw new Error('useFinanceAI debe utilizarse dentro de un FinanceAIProvider');
  }
  return context;
};

// ── COMPONENTE GLOBAL: Widget flotante de progreso de IA ──────────────────────
export const FloatingAIProgressWidget: React.FC = () => {
  const { cargandoIA, estadoPasosIA, completadoRecientemente, setCompletadoRecientemente, lotes } = useFinanceAI();
  const isFinancePage = window.location.pathname.includes('/finanzas');

  if (isFinancePage) return null;

  const totalCompletados = lotes.filter(l => l.estado === 'completado').length;

  if (cargandoIA) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900/90 backdrop-blur-md text-white border border-indigo-900/50 shadow-2xl p-4 rounded-2xl w-80 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
            <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-300 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">
              Escaneo con IA Activo
            </span>
            <p className="text-xs font-semibold text-white truncate">
              Procesando tus facturas en lote
            </p>
            <p className="text-[10.5px] text-slate-400 truncate animate-pulse mt-0.5">
              {estadoPasosIA || 'Analizando imágenes...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (completadoRecientemente) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-br from-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-2xl p-4 rounded-2xl w-80 animate-bounce-subtle">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Check size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                ¡Análisis Completado!
              </span>
              <button
                onClick={() => setCompletadoRecientemente(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-all"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs font-semibold text-white mt-0.5">
              La IA terminó de extraer {totalCompletados} factura(s).
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Regresa a la sección de Finanzas para revisar y guardar el lote.
            </p>
            <button
              onClick={() => {
                window.location.href = '/finanzas';
                setCompletadoRecientemente(false);
              }}
              className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-md active:scale-[0.98]"
            >
              Revisar Lote Ahora <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
