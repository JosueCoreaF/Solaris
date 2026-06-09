import React, { useState, useEffect, useRef, DragEvent } from 'react';
import {
  Mail, Palette, Save, Eye, Smartphone, Monitor, Sparkles,
  Trash2, Type, Minus, Gift, ExternalLink, PenTool,
  Calendar, Shield, QrCode, GripVertical, X, Layers,
  ChevronUp, ChevronDown, Hash, Check, Copy
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { fetchCustomTemplateByType, saveCustomTemplate, previewCustomTemplate } from '../../api/bookingsService';

// ── Types ──────────────────────────────────────────────────────────────────
export interface CorreoBloque {
  id: string;
  type: 'texto' | 'divisor' | 'upselling' | 'cta' | 'firma' | 'booking_details' | 'preparacion_viaje' | 'codigo_qr';
  texto?: string;
  cuerpo?: string;
  url?: string;
  titulo?: string;
  descripcion?: string;
  precio?: string;
  cta_texto?: string;
  color_fondo?: string;
  firma_texto?: string;
  checkin_time?: string;
  checkout_time?: string;
  politicas_extras?: string;
}

type BlockType = CorreoBloque['type'];
type DragOp = { kind: 'palette'; blockType: BlockType } | { kind: 'canvas'; blockId: string };

// ── Constants ──────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'confirmacion', label: 'Reserva Confirmada', desc: 'Al confirmar una reserva' },
  { id: 'actualizacion', label: 'Reserva Modificada', desc: 'Al cambiar fechas o habitación' },
  { id: 'cancelacion', label: 'Reserva Cancelada', desc: 'Tras cancelar la reserva' },
  { id: 'cotizacion', label: 'Cotización', desc: 'Al emitir una cotización' },
];

const PALETTE_ELEMENTS: { type: BlockType; label: string; icon: React.ElementType; group: 'basicos' | 'widgets'; color: string; bg: string; border: string }[] = [
  { type: 'texto', label: 'Texto Libre', icon: Type, group: 'basicos', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { type: 'firma', label: 'Firma / Cierre', icon: PenTool, group: 'basicos', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { type: 'cta', label: 'Botón de Acción', icon: ExternalLink, group: 'basicos', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { type: 'divisor', label: 'Divisor', icon: Minus, group: 'basicos', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { type: 'booking_details', label: 'Resumen de Estadía', icon: Calendar, group: 'widgets', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { type: 'preparacion_viaje', label: 'Preparar Viaje', icon: Shield, group: 'widgets', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { type: 'codigo_qr', label: 'Código QR Check-in', icon: QrCode, group: 'widgets', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { type: 'upselling', label: 'Banner de Upselling', icon: Gift, group: 'widgets', color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
];

const VARIABLES = [
  { name: 'Huésped', token: '{{huesped}}', desc: 'Nombre completo del huésped' },
  { name: 'Hotel', token: '{{hotel}}', desc: 'Nombre del hotel' },
  { name: 'Check-in', token: '{{check_in}}', desc: 'Fecha de ingreso formateada' },
  { name: 'Check-out', token: '{{check_out}}', desc: 'Fecha de salida formateada' },
  { name: 'Habitación', token: '{{habitacion}}', desc: 'Alias o número de habitación' },
  { name: 'Total', token: '{{total}}', desc: 'Monto total con moneda' },
  { name: 'Moneda', token: '{{moneda}}', desc: 'Código de moneda (HNL, USD)' },
  { name: 'ID Reserva', token: '{{bookingId}}', desc: 'Identificador único de la reserva' },
];

const PRESET_COLORS = [
  { name: 'Slate', value: '#0f172a' },
  { name: 'Ocean Blue', value: '#1d4ed8' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Burgundy', value: '#991b1b' },
];

const FONTS = [
  { name: 'Inter (Moderna)', value: "'Inter', Helvetica, Arial, sans-serif" },
  { name: 'Outfit (Elegante)', value: "'Outfit', sans-serif" },
  { name: 'Roboto (Limpia)', value: "'Roboto', sans-serif" },
  { name: 'Arial (Clásica)', value: 'Arial, Helvetica, sans-serif' },
];

// ── Block factory ──────────────────────────────────────────────────────────
function createBlock(type: BlockType): CorreoBloque {
  const id = `b-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  switch (type) {
    case 'texto': return { id, type, cuerpo: 'Hola {{huesped}},\n\nEscribe aquí tu mensaje personalizado para el huésped.' };
    case 'firma': return { id, type, firma_texto: 'Atentamente,\nEl Equipo de {{hotel}}' };
    case 'cta': return { id, type, texto: 'Hacer Web Check-in', url: 'https://solarys.uk/checkin/{{bookingId}}' };
    case 'divisor': return { id, type };
    case 'booking_details': return { id, type };
    case 'preparacion_viaje': return { id, type, checkin_time: '3:00 PM', checkout_time: '12:00 PM', politicas_extras: 'Recuerda presentar tu documento de identidad oficial al ingresar.' };
    case 'codigo_qr': return { id, type };
    case 'upselling': return { id, type, titulo: '🍳 Añadir Desayuno Buffet', descripcion: 'Disfruta de frutas frescas, waffles calientes y café de la casa.', precio: 'L 250 / persona', cta_texto: 'Añadir Desayuno', color_fondo: '#f0fdf4' };
  }
}

function getDefaultBody(section: string) {
  const map: Record<string, string> = {
    confirmacion: 'Hola {{huesped}},\n\nTu reserva en {{hotel}} ha sido confirmada exitosamente. A continuación detallamos los datos de tu estadía.',
    actualizacion: 'Hola {{huesped}},\n\nTe informamos que tu reserva en {{hotel}} ha sido actualizada con éxito.',
    cancelacion: 'Hola {{huesped}},\n\nLamentamos informarte que tu reserva en {{hotel}} ha sido cancelada.',
    cotizacion: 'Estimado(a) {{huesped}},\n\nAdjuntamos la cotización de hospedaje que solicitaste para {{hotel}}.',
  };
  return map[section] ?? '';
}

function getDefaultSubject(section: string) {
  const map: Record<string, string> = {
    confirmacion: 'Confirmación de Reserva - {{hotel}}',
    actualizacion: 'Reserva actualizada — {{hotel}}',
    cancelacion: 'Reserva cancelada — {{hotel}}',
    cotizacion: 'Cotización de Hospedaje — {{hotel}}',
  };
  return map[section] ?? '';
}

function getBlockLabel(type: BlockType) {
  const labels: Record<BlockType, string> = {
    texto: 'Texto', divisor: 'Divisor', upselling: 'Upselling',
    cta: 'Botón CTA', firma: 'Firma', booking_details: 'Resumen',
    preparacion_viaje: 'Prep. Viaje', codigo_qr: 'Código QR',
  };
  return labels[type];
}

// ── Canvas Block Visual ────────────────────────────────────────────────────
function BlockVisual({ block, brandColor }: { block: CorreoBloque; brandColor: string }) {
  switch (block.type) {
    case 'texto':
      return (
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap', padding: '4px 0' }}>
          {block.cuerpo || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Bloque de texto vacío — editalo en el inspector.</span>}
        </div>
      );

    case 'divisor':
      return <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />;

    case 'booking_details':
      return (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', backgroundColor: '#f8fafc' }}>
            {[
              { label: 'Check-in', value: '{{check_in}}' },
              { label: 'Habitación', value: '{{habitacion}}' },
              { label: 'Check-out', value: '{{check_out}}' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderRight: i < 2 ? '1px solid #e2e8f0' : undefined }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: brandColor, marginTop: 4 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px', backgroundColor: brandColor, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginRight: 6 }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{'{{total}} {{moneda}}'}</span>
          </div>
        </div>
      );

    case 'cta':
      return (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ display: 'inline-block', backgroundColor: brandColor, color: '#ffffff', padding: '11px 30px', borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: '0.01em' }}>
            {block.texto || 'Botón de Acción'}
          </div>
          {block.url && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {block.url}
            </div>
          )}
        </div>
      );

    case 'upselling':
      return (
        <div style={{ backgroundColor: block.color_fondo || '#f0fdf4', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 26, flexShrink: 0 }}>🍳</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{block.titulo || 'Título del servicio'}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{block.descripcion || 'Descripción del extra...'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            {block.precio && <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>{block.precio}</div>}
            {block.cta_texto && <div style={{ backgroundColor: '#059669', color: '#fff', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{block.cta_texto}</div>}
          </div>
        </div>
      );

    case 'firma':
      return (
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontStyle: 'italic', padding: '4px 0' }}>
          {block.firma_texto || <span style={{ color: '#94a3b8' }}>Firma / cierre del correo...</span>}
        </div>
      );

    case 'preparacion_viaje':
      return (
        <div style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preparación para tu Visita</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: block.politicas_extras ? 10 : 0 }}>
            {[
              { label: 'Check-in', val: block.checkin_time || '3:00 PM' },
              { label: 'Check-out', val: block.checkout_time || '12:00 PM' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: brandColor, marginTop: 4 }}>{item.val}</div>
              </div>
            ))}
          </div>
          {block.politicas_extras && (
            <div style={{ fontSize: 11, color: '#475569', backgroundColor: '#eff6ff', padding: '8px 12px', borderRadius: 6, borderLeft: `3px solid ${brandColor}`, lineHeight: 1.5 }}>
              {block.politicas_extras}
            </div>
          )}
        </div>
      );

    case 'codigo_qr':
      return (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px', backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 72, height: 72, backgroundColor: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={36} style={{ color: '#94a3b8' }} />
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Código QR dinámico · {'{{bookingId}}'}</div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Canvas Drop Indicator ──────────────────────────────────────────────────
function DropIndicator({ active }: { active: boolean }) {
  return (
    <div style={{
      height: active ? 28 : 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'height 0.15s ease',
      overflow: 'hidden',
    }}>
      {active && (
        <div style={{
          width: '100%',
          height: 3,
          backgroundColor: '#4f46e5',
          borderRadius: 2,
          boxShadow: '0 0 0 3px rgba(79,70,229,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ backgroundColor: '#4f46e5', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>INSERTAR AQUÍ</div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export const EmailTemplatesPage: React.FC = () => {
  const { addToast } = useToast();

  // Section & tabs
  const [activeSection, setActiveSection] = useState<'confirmacion' | 'actualizacion' | 'cancelacion' | 'cotizacion'>('confirmacion');
  const [leftTab, setLeftTab] = useState<'elementos' | 'variables'>('elementos');
  const [rightTab, setRightTab] = useState<'propiedades' | 'estilos'>('propiedades');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [asunto, setAsunto] = useState('');
  const [bloques, setBloques] = useState<CorreoBloque[]>([]);
  const [colorCabecera, setColorCabecera] = useState('#0f172a');
  const [fuente, setFuente] = useState("'Inter', Helvetica, Arial, sans-serif");
  const [tamanoLetra, setTamanoLetra] = useState('14px');
  const [logoUrl, setLogoUrl] = useState('');

  // Canvas interaction
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragOp | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [compiledHtml, setCompiledHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Variable copy feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Inspector focus ref (for variable insertion)
  const activeInputRef = useRef<{ field: string; element: HTMLTextAreaElement | HTMLInputElement | null } | null>(null);

  const selectedBlock = bloques.find(b => b.id === selectedBlockId) ?? null;

  // ── Load template ──────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedBlockId(null);
    loadTemplate();
  }, [activeSection]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomTemplateByType(activeSection);
      if (data) {
        setAsunto(data.asunto || '');
        setColorCabecera(data.estilos?.color_cabecera || '#0f172a');
        setFuente(data.estilos?.fuente || "'Inter', Helvetica, Arial, sans-serif");
        setTamanoLetra(data.estilos?.tamano_letra || '14px');
        setLogoUrl(data.estilos?.logo_url || '');
        if (Array.isArray(data.estilos?.bloques) && data.estilos.bloques.length > 0) {
          setBloques(data.estilos.bloques);
        } else {
          setBloques(getDefaultBlocks());
        }
      } else {
        setAsunto(getDefaultSubject(activeSection));
        setColorCabecera('#0f172a');
        setFuente("'Inter', Helvetica, Arial, sans-serif");
        setTamanoLetra('14px');
        setLogoUrl('');
        setBloques(getDefaultBlocks());
      }
    } catch {
      addToast('Error al cargar la plantilla.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultBlocks = (): CorreoBloque[] => [
    { id: 'b-def-text', type: 'texto', cuerpo: getDefaultBody(activeSection) },
    { id: 'b-def-details', type: 'booking_details' },
    { id: 'b-def-prep', type: 'preparacion_viaje', checkin_time: '3:00 PM', checkout_time: '12:00 PM', politicas_extras: 'Recuerda presentar tu documento de identidad oficial al ingresar.' },
    { id: 'b-def-firma', type: 'firma', firma_texto: 'Atentamente,\nEquipo de Reservas' },
  ];

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCustomTemplate({
        tipo_plantilla: activeSection,
        asunto,
        cuerpo_personalizado: bloques.find(b => b.type === 'texto')?.cuerpo || '',
        estilos: { color_cabecera: colorCabecera, fuente, tamano_letra: tamanoLetra, logo_url: logoUrl, firma: bloques.find(b => b.type === 'firma')?.firma_texto || '', bloques },
      });
      addToast('Plantilla guardada y activa para todos los correos transaccionales.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Error al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Preview ────────────────────────────────────────────────────────────
  const handleOpenPreview = async () => {
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const res = await previewCustomTemplate({
        tipo_plantilla: activeSection,
        asunto,
        cuerpo_personalizado: bloques.find(b => b.type === 'texto')?.cuerpo || '',
        estilos: { color_cabecera: colorCabecera, fuente, tamano_letra: tamanoLetra, logo_url: logoUrl, firma: bloques.find(b => b.type === 'firma')?.firma_texto || '', bloques },
      });
      setCompiledHtml(res.html);
    } catch {
      addToast('Error al compilar la previsualización.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Block management ───────────────────────────────────────────────────
  const updateBlock = (id: string, updates: Partial<CorreoBloque>) => {
    setBloques(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBloques(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (id: string, dir: 'up' | 'down') => {
    setBloques(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const insertBlock = (blockType: BlockType, atIndex: number) => {
    const newBlock = createBlock(blockType);
    setBloques(prev => {
      const next = [...prev];
      next.splice(atIndex, 0, newBlock);
      return next;
    });
    setSelectedBlockId(newBlock.id);
    setRightTab('propiedades');
  };

  // ── Drag & Drop (palette → canvas) ────────────────────────────────────
  const handlePaletteDragStart = (e: DragEvent, blockType: BlockType) => {
    e.dataTransfer.effectAllowed = 'copy';
    setActiveDrag({ kind: 'palette', blockType });
  };

  const handleCanvasDragStart = (e: DragEvent, blockId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setActiveDrag({ kind: 'canvas', blockId });
  };

  const handleDropZoneOver = (e: DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = activeDrag?.kind === 'canvas' ? 'move' : 'copy';
    setDropIndex(idx);
  };

  const handleDropZoneDrop = (e: DragEvent, idx: number) => {
    e.preventDefault();
    setDropIndex(null);
    if (!activeDrag) return;

    if (activeDrag.kind === 'palette') {
      insertBlock(activeDrag.blockType, idx);
    } else {
      // reorder
      const fromId = activeDrag.blockId;
      setBloques(prev => {
        const fromIdx = prev.findIndex(b => b.id === fromId);
        if (fromIdx < 0) return prev;
        const next = [...prev];
        const [removed] = next.splice(fromIdx, 1);
        const insertAt = idx > fromIdx ? idx - 1 : idx;
        next.splice(insertAt, 0, removed);
        return next;
      });
    }
    setActiveDrag(null);
  };

  const handleDragEnd = () => {
    setActiveDrag(null);
    setDropIndex(null);
  };

  // ── Variables ──────────────────────────────────────────────────────────
  const handleInsertVariable = (token: string) => {
    if (activeInputRef.current?.element && selectedBlockId) {
      const { field, element } = activeInputRef.current;
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? start;
      const newVal = element.value.substring(0, start) + token + element.value.substring(end);
      if (selectedBlockId === '__asunto__') {
        setAsunto(newVal);
      } else {
        updateBlock(selectedBlockId, { [field]: newVal });
      }
      setTimeout(() => {
        element.focus();
        element.selectionStart = element.selectionEnd = start + token.length;
      }, 30);
    } else {
      navigator.clipboard.writeText(token).catch(() => { });
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
      addToast(`Variable ${token} copiada al portapapeles.`, 'info');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Inter", -apple-system, sans-serif', backgroundColor: '#f1f5f9' }}>

      {/* ─── LEFT SIDEBAR ───────────────────────────────────────────── */}
      <div style={{ width: 264, flexShrink: 0, backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Brand header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, backgroundColor: 'rgba(79,70,229,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={16} style={{ color: '#4f46e5' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Email Studio</div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>Solaris · Constructor Visual</div>
          </div>
        </div>

        {/* Section selector */}
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, padding: '0 4px' }}>Tipo de Correo</div>
          {SECTIONS.map(sec => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 8, border: 'none', marginBottom: 2,
                  backgroundColor: isActive ? 'rgba(79,70,229,0.08)' : 'transparent',
                  color: isActive ? '#4f46e5' : '#475569', cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isActive ? '#4f46e5' : '#cbd5e1', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500 }}>{sec.label}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>{sec.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 12px' }}>
          {(['elementos', 'variables'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLeftTab(tab)}
              style={{
                flex: 1, padding: '10px 4px', border: 'none', backgroundColor: 'transparent',
                borderBottom: `2px solid ${leftTab === tab ? '#4f46e5' : 'transparent'}`,
                color: leftTab === tab ? '#4f46e5' : '#94a3b8',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {tab === 'elementos' ? <Layers size={11} /> : <Hash size={11} />}
              {tab === 'elementos' ? 'Elementos' : 'Variables'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

          {leftTab === 'elementos' && (
            <>
              {/* Basic blocks */}
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 2px' }}>Básicos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                {PALETTE_ELEMENTS.filter(e => e.group === 'basicos').map(elem => {
                  const Icon = elem.icon;
                  return (
                    <div
                      key={elem.type}
                      draggable
                      onDragStart={e => handlePaletteDragStart(e, elem.type)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { insertBlock(elem.type, bloques.length); }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 10, border: `1.5px dashed ${elem.border}`,
                        backgroundColor: elem.bg, cursor: 'grab', transition: 'all 0.15s',
                        color: elem.color, userSelect: 'none',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderStyle = 'solid'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderStyle = 'dashed'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <Icon size={18} />
                      <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{elem.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Hotel widgets */}
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={9} /> Widgets Hotel
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PALETTE_ELEMENTS.filter(e => e.group === 'widgets').map(elem => {
                  const Icon = elem.icon;
                  return (
                    <div
                      key={elem.type}
                      draggable
                      onDragStart={e => handlePaletteDragStart(e, elem.type)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { insertBlock(elem.type, bloques.length); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, border: `1.5px dashed ${elem.border}`,
                        backgroundColor: elem.bg, cursor: 'grab', transition: 'all 0.15s',
                        color: elem.color, userSelect: 'none',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderStyle = 'solid'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderStyle = 'dashed'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{elem.label}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>Widget inteligente</div>
                      </div>
                      <GripVertical size={12} style={{ marginLeft: 'auto', color: '#cbd5e1' }} />
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>Cómo usar</div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
                  Arrastra un elemento sobre el lienzo o haz clic para añadirlo al final.
                </div>
              </div>
            </>
          )}

          {leftTab === 'variables' && (
            <>
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, marginBottom: 12, padding: '10px 12px', backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                <strong style={{ color: '#1d4ed8' }}>Cómo insertar:</strong> Coloca el cursor en un campo de texto del inspector y haz clic en la variable.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {VARIABLES.map(v => (
                  <button
                    key={v.token}
                    onClick={() => handleInsertVariable(v.token)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #e2e8f0', backgroundColor: '#ffffff',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#4f46e5'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    <div style={{ width: 28, height: 28, backgroundColor: 'rgba(79,70,229,0.08)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {copiedToken === v.token ? <Check size={12} style={{ color: '#4f46e5' }} /> : <Hash size={12} style={{ color: '#4f46e5' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.token}</div>
                    </div>
                    <Copy size={11} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── MAIN CANVAS AREA ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top Toolbar */}
        <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Asunto */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Asunto del correo</div>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              onFocus={e => { activeInputRef.current = { field: 'asunto', element: e.target }; setSelectedBlockId('__asunto__'); }}
              placeholder="Asunto del correo..."
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#0f172a', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}
            />
          </div>

          {/* Desktop/Mobile toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }}>
            {(['desktop', 'mobile'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
                  border: 'none', backgroundColor: previewMode === mode ? '#ffffff' : 'transparent',
                  color: previewMode === mode ? '#0f172a' : '#64748b',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  boxShadow: previewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'desktop' ? <Monitor size={12} /> : <Smartphone size={12} />}
                {mode === 'desktop' ? 'Escritorio' : 'Móvil'}
              </button>
            ))}
          </div>

          {/* Preview & Save */}
          <button
            onClick={handleOpenPreview}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
          >
            <Eye size={13} /> Vista Previa Real
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: saving || loading ? 0.7 : 1, flexShrink: 0, transition: 'all 0.15s' }}
          >
            {saving
              ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              : <Save size={13} />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'center', padding: '32px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748b', fontSize: 13, fontWeight: 500 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Cargando lienzo...
            </div>
          ) : (
            <div style={{
              width: previewMode === 'desktop' ? '100%' : '375px',
              maxWidth: previewMode === 'desktop' ? 620 : 375,
              transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), max-width 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* Email chrome */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 4, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid #e2e8f0', fontSize: 10, color: '#64748b' }}>
                <div><span style={{ fontWeight: 700 }}>De:</span> Notificaciones Solaris &lt;reservas@solarys.uk&gt;</div>
                <div><span style={{ fontWeight: 700 }}>Asunto:</span> <span style={{ color: '#0f172a', fontWeight: 600 }}>{asunto || '(Sin Asunto)'}</span></div>
              </div>

              {/* Email card */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                {/* Brand header */}
                <div style={{ backgroundColor: colorCabecera, padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>{'{{hotel}}'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Notificación de Reserva</div>
                  </div>
                </div>

                {/* Blocks drop area */}
                <div
                  style={{ padding: '24px 28px', minHeight: 200 }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    if (dropIndex === null) handleDropZoneDrop(e, bloques.length);
                  }}
                >
                  {bloques.length === 0 && (
                    <div
                      style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}
                      onDragOver={e => handleDropZoneOver(e, 0)}
                      onDrop={e => handleDropZoneDrop(e, 0)}
                    >
                      <Layers size={24} style={{ color: '#cbd5e1', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600 }}>Lienzo vacío</div>
                      <div style={{ marginTop: 4, fontSize: 11 }}>Arrastra elementos desde el panel izquierdo</div>
                    </div>
                  )}

                  {bloques.map((block, idx) => {
                    const isSelected = selectedBlockId === block.id;
                    const isHovered = hoveredBlockId === block.id;
                    const isDraggingThis = activeDrag?.kind === 'canvas' && activeDrag.blockId === block.id;

                    return (
                      <div key={block.id}>
                        {/* Drop zone above block */}
                        <div
                          style={{ position: 'relative', zIndex: 1 }}
                          onDragOver={e => handleDropZoneOver(e, idx)}
                          onDrop={e => handleDropZoneDrop(e, idx)}
                        >
                          <DropIndicator active={dropIndex === idx && !!activeDrag} />
                        </div>

                        {/* Block */}
                        <div
                          style={{
                            position: 'relative',
                            borderRadius: 8,
                            transition: 'all 0.15s',
                            opacity: isDraggingThis ? 0.35 : 1,
                            outline: isSelected
                              ? `2px solid #4f46e5`
                              : isHovered
                                ? `2px dashed #93c5fd`
                                : '2px solid transparent',
                            outlineOffset: 2,
                            backgroundColor: isSelected ? 'rgba(79,70,229,0.025)' : 'transparent',
                            cursor: 'pointer',
                            padding: '4px',
                            marginBottom: 2,
                          }}
                          onClick={() => { setSelectedBlockId(block.id); setRightTab('propiedades'); }}
                          onMouseEnter={() => setHoveredBlockId(block.id)}
                          onMouseLeave={() => setHoveredBlockId(null)}
                        >
                          {/* Block label bar */}
                          {(isSelected || isHovered) && (
                            <div style={{
                              position: 'absolute', top: -22, left: 0, zIndex: 10,
                              display: 'flex', alignItems: 'center', gap: 2,
                            }}>
                              {/* Drag handle */}
                              <div
                                draggable
                                onDragStart={e => handleCanvasDragStart(e, block.id)}
                                onDragEnd={handleDragEnd}
                                style={{ backgroundColor: isSelected ? '#4f46e5' : '#93c5fd', color: '#fff', borderRadius: '4px 0 0 4px', padding: '2px 5px', cursor: 'grab', display: 'flex', alignItems: 'center' }}
                              >
                                <GripVertical size={11} />
                              </div>
                              <div style={{ backgroundColor: isSelected ? '#4f46e5' : '#93c5fd', color: '#ffffff', fontSize: 9, fontWeight: 800, padding: '2px 7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {getBlockLabel(block.type)}
                              </div>
                              {isSelected && (
                                <>
                                  <button onClick={e => { e.stopPropagation(); moveBlock(block.id, 'up'); }} disabled={idx === 0} style={{ backgroundColor: '#4f46e5', color: idx === 0 ? 'rgba(255,255,255,0.3)' : '#fff', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                                    <ChevronUp size={11} />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); moveBlock(block.id, 'down'); }} disabled={idx === bloques.length - 1} style={{ backgroundColor: '#4f46e5', color: idx === bloques.length - 1 ? 'rgba(255,255,255,0.3)' : '#fff', border: 'none', cursor: idx === bloques.length - 1 ? 'default' : 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                                    <ChevronDown size={11} />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', padding: '2px 5px', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center' }}>
                                    <X size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          <BlockVisual block={block} brandColor={colorCabecera} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Drop zone at end */}
                  <div
                    onDragOver={e => handleDropZoneOver(e, bloques.length)}
                    onDrop={e => handleDropZoneDrop(e, bloques.length)}
                  >
                    <DropIndicator active={dropIndex === bloques.length && !!activeDrag} />
                  </div>

                  {/* Sección fija de aceptar/rechazar — solo visible en cotizacion */}
                  {activeSection === 'cotizacion' && (
                    <div style={{ marginTop: 12, padding: '18px 20px', borderTop: '2px dashed #e2e8f0', backgroundColor: '#f8fafc', borderRadius: 8, textAlign: 'center', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 7, right: 10, fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fijo · No editable</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>Confirmación de la cotización</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>El cliente recibirá estos botones para aceptar o rechazar la cotización.</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ backgroundColor: colorCabecera, color: '#fff', padding: '10px 22px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Aceptar cotización</div>
                        <div style={{ backgroundColor: '#ffffff', color: '#475569', padding: '10px 22px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #cbd5e1' }}>Rechazar cotización</div>
                      </div>
                    </div>
                  )}

                  {/* "Drop here" placeholder when dragging from palette */}
                  {activeDrag?.kind === 'palette' && bloques.length > 0 && (
                    <div style={{ border: '2px dashed #a5b4fc', borderRadius: 8, padding: '12px', textAlign: 'center', color: '#818cf8', fontSize: 11, fontWeight: 600, marginTop: 8 }}>
                      ↓ Suéltalo en cualquier zona azul
                    </div>
                  )}
                </div>

                {/* Email footer */}
                <div style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '16px 28px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
                    Este correo fue enviado por {'{{hotel}}'} · Powered by Solaris
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT PROPERTIES PANEL ─────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, backgroundColor: '#ffffff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Right tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 12px' }}>
          {(['propiedades', 'estilos'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              style={{
                flex: 1, padding: '10px 4px', border: 'none', backgroundColor: 'transparent',
                borderBottom: `2px solid ${rightTab === tab ? '#4f46e5' : 'transparent'}`,
                color: rightTab === tab ? '#4f46e5' : '#94a3b8',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
            >
              {tab === 'propiedades' ? 'Propiedades' : 'Estilos'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* ── PROPIEDADES TAB ── */}
          {rightTab === 'propiedades' && (
            <>
              {selectedBlock ? (
                <>
                  {/* Inspector header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Editando</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>{getBlockLabel(selectedBlock.type)}</div>
                    </div>
                    <button onClick={() => setSelectedBlockId(null)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Variables quick insert */}
                  {['texto', 'firma', 'preparacion_viaje', 'upselling', 'cta'].includes(selectedBlock.type) && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Insertar Variable</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {VARIABLES.slice(0, 6).map(v => (
                          <button
                            key={v.token}
                            onClick={() => handleInsertVariable(v.token)}
                            title={v.desc}
                            style={{ fontSize: 10, fontWeight: 600, backgroundColor: 'rgba(79,70,229,0.07)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer' }}
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* texto */}
                  {selectedBlock.type === 'texto' && (
                    <div>
                      <label style={labelStyle}>Contenido del Mensaje</label>
                      <textarea
                        rows={6}
                        value={selectedBlock.cuerpo || ''}
                        onChange={e => updateBlock(selectedBlock.id, { cuerpo: e.target.value })}
                        onFocus={e => activeInputRef.current = { field: 'cuerpo', element: e.target }}
                        placeholder="Escribe el texto de tu correo..."
                        style={textareaStyle}
                      />
                    </div>
                  )}

                  {/* divisor */}
                  {selectedBlock.type === 'divisor' && (
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
                      El divisor es una línea horizontal de separación. No tiene propiedades adicionales.
                    </div>
                  )}

                  {/* cta */}
                  {selectedBlock.type === 'cta' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Texto del Botón</label>
                        <input type="text" value={selectedBlock.texto || ''} onChange={e => updateBlock(selectedBlock.id, { texto: e.target.value })} onFocus={e => activeInputRef.current = { field: 'texto', element: e.target }} placeholder="Hacer Web Check-in" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>URL Destino</label>
                        <input type="text" value={selectedBlock.url || ''} onChange={e => updateBlock(selectedBlock.id, { url: e.target.value })} onFocus={e => activeInputRef.current = { field: 'url', element: e.target }} placeholder="https://solarys.uk/checkin/{{bookingId}}" style={inputStyle} />
                      </div>
                    </div>
                  )}

                  {/* upselling */}
                  {selectedBlock.type === 'upselling' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Título del Servicio</label>
                        <input type="text" value={selectedBlock.titulo || ''} onChange={e => updateBlock(selectedBlock.id, { titulo: e.target.value })} onFocus={e => activeInputRef.current = { field: 'titulo', element: e.target }} placeholder="🍳 Desayuno Buffet" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Descripción</label>
                        <textarea rows={2} value={selectedBlock.descripcion || ''} onChange={e => updateBlock(selectedBlock.id, { descripcion: e.target.value })} onFocus={e => activeInputRef.current = { field: 'descripcion', element: e.target }} style={textareaStyle} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Precio</label>
                          <input type="text" value={selectedBlock.precio || ''} onChange={e => updateBlock(selectedBlock.id, { precio: e.target.value })} placeholder="L 250 / pers." style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Texto Botón</label>
                          <input type="text" value={selectedBlock.cta_texto || ''} onChange={e => updateBlock(selectedBlock.id, { cta_texto: e.target.value })} placeholder="Añadir" style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Fondo de la Tarjeta</label>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {['#f0fdf4', '#eff6ff', '#fffbeb', '#fdf2f8', '#f8fafc', '#fff1f2'].map(c => (
                            <button key={c} onClick={() => updateBlock(selectedBlock.id, { color_fondo: c })} style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: c, border: selectedBlock.color_fondo === c ? '2.5px solid #4f46e5' : '1px solid #cbd5e1', cursor: 'pointer' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* firma */}
                  {selectedBlock.type === 'firma' && (
                    <div>
                      <label style={labelStyle}>Texto de Firma</label>
                      <textarea rows={3} value={selectedBlock.firma_texto || ''} onChange={e => updateBlock(selectedBlock.id, { firma_texto: e.target.value })} onFocus={e => activeInputRef.current = { field: 'firma_texto', element: e.target }} placeholder="Atentamente,&#10;Equipo de Reservas" style={textareaStyle} />
                    </div>
                  )}

                  {/* booking_details */}
                  {selectedBlock.type === 'booking_details' && (
                    <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>Widget Automático</div>
                      <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                        Muestra automáticamente: fechas de check-in/out, habitación y total según los datos de la reserva. No requiere configuración.
                      </div>
                    </div>
                  )}

                  {/* preparacion_viaje */}
                  {selectedBlock.type === 'preparacion_viaje' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Hora Check-in</label>
                          <input type="text" value={selectedBlock.checkin_time || ''} onChange={e => updateBlock(selectedBlock.id, { checkin_time: e.target.value })} placeholder="3:00 PM" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Hora Check-out</label>
                          <input type="text" value={selectedBlock.checkout_time || ''} onChange={e => updateBlock(selectedBlock.id, { checkout_time: e.target.value })} placeholder="12:00 PM" style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Políticas Adicionales</label>
                        <textarea rows={3} value={selectedBlock.politicas_extras || ''} onChange={e => updateBlock(selectedBlock.id, { politicas_extras: e.target.value })} onFocus={e => activeInputRef.current = { field: 'politicas_extras', element: e.target }} placeholder="Reglas especiales, parqueo, etc..." style={textareaStyle} />
                      </div>
                    </div>
                  )}

                  {/* codigo_qr */}
                  {selectedBlock.type === 'codigo_qr' && (
                    <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>Widget Dinámico</div>
                      <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                        Genera un código QR único basado en {'{{bookingId}}'} para agilizar el check-in del huésped en recepción.
                      </div>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => removeBlock(selectedBlock.id)}
                    style={{ marginTop: 16, width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Trash2 size={12} /> Eliminar este bloque
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 200, color: '#94a3b8', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, backgroundColor: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={22} style={{ color: '#cbd5e1' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Sin selección</div>
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>Haz clic en cualquier bloque del lienzo para editar sus propiedades aquí.</div>
                </div>
              )}
            </>
          )}

          {/* ── ESTILOS TAB ── */}
          {rightTab === 'estilos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Brand color */}
              <div>
                <label style={labelStyle}>Color Principal de Marca</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input type="color" value={colorCabecera} onChange={e => setColorCabecera(e.target.value)} style={{ border: 'none', outline: 'none', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', padding: 0, backgroundColor: 'transparent' }} />
                  <input type="text" value={colorCabecera} onChange={e => setColorCabecera(e.target.value)} maxLength={7} placeholder="#0f172a" style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c.value} onClick={() => setColorCabecera(c.value)} title={c.name} style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: c.value, border: colorCabecera.toLowerCase() === c.value.toLowerCase() ? '2.5px solid #4f46e5' : '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                  ))}
                </div>
              </div>

              {/* Logo URL */}
              <div>
                <label style={labelStyle}>Logotipo (URL de imagen)</label>
                <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://tuhotel.com/logo.png" style={inputStyle} />
                {logoUrl && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: colorCabecera, borderRadius: 6, textAlign: 'center' }}>
                    <img src={logoUrl} alt="Preview logo" style={{ maxHeight: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              {/* Font */}
              <div>
                <label style={labelStyle}>Tipografía Global</label>
                <select value={fuente} onChange={e => setFuente(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', backgroundColor: '#ffffff' }}>
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>

              {/* Text size */}
              <div>
                <label style={labelStyle}>Tamaño de Texto Base</label>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['13px', '14px', '15px', '16px', '18px'].map(size => (
                    <button
                      key={size}
                      onClick={() => setTamanoLetra(size)}
                      style={{
                        flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 700,
                        backgroundColor: tamanoLetra === size ? 'rgba(79,70,229,0.08)' : '#ffffff',
                        color: tamanoLetra === size ? '#4f46e5' : '#475569',
                        border: `1px solid ${tamanoLetra === size ? '#4f46e5' : '#e2e8f0'}`,
                        borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asunto (also accessible from styles) */}
              <div>
                <label style={labelStyle}>Asunto del Correo</label>
                <input
                  type="text"
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  onFocus={e => { activeInputRef.current = { field: 'asunto', element: e.target }; setSelectedBlockId('__asunto__'); }}
                  placeholder="Asunto..."
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── PREVIEW MODAL ──────────────────────────────────────────────── */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: 16, width: '90vw', maxWidth: 680, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eye size={16} style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Vista Previa Real del Correo</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', padding: '2px 8px', borderRadius: 20 }}>HTML compilado</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: 2, borderRadius: 7 }}>
                  {(['desktop', 'mobile'] as const).map(mode => (
                    <button key={mode} onClick={() => setPreviewMode(mode)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: 'none', backgroundColor: previewMode === mode ? '#ffffff' : 'transparent', color: previewMode === mode ? '#0f172a' : '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: previewMode === mode ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
                      {mode === 'desktop' ? <Monitor size={11} /> : <Smartphone size={11} />}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowPreview(false)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal iframe */}
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'center', padding: 24 }}>
              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#64748b', fontSize: 13 }}>
                  <div style={{ width: 24, height: 24, border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Compilando plantilla...
                </div>
              ) : (
                <div style={{ width: previewMode === 'desktop' ? '100%' : '375px', maxWidth: 600, backgroundColor: '#ffffff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: previewMode === 'mobile' ? '6px solid #0f172a' : '1px solid #e2e8f0', height: 'fit-content', minHeight: 400 }}>
                  <iframe
                    title="Email Preview"
                    srcDoc={compiledHtml}
                    style={{ width: '100%', height: 600, border: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

// ── Shared input styles ────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '7px',
  fontSize: '12px',
  outline: 'none',
  color: '#0f172a',
  backgroundColor: '#f8fafc',
  transition: 'border-color 0.15s',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '7px',
  fontSize: '12px',
  outline: 'none',
  color: '#0f172a',
  backgroundColor: '#f8fafc',
  fontFamily: 'inherit',
  lineHeight: '1.55',
  resize: 'vertical',
};
