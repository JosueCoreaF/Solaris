/**
 * DatePicker — Componente de fecha premium para Solaris Hotel
 *
 * Exports:
 *   DatePicker       — selector de fecha única
 *   DateRangePicker  — selector de rango (from / to)
 *
 * API compatible con <input type="date">:
 *   value / onChange  →  string YYYY-MM-DD
 */

import React, {
  useState, useEffect, useRef, useCallback, useId,
} from 'react';
import { createPortal } from 'react-dom';

// ── Constantes ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Utilidades de fecha ───────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(s: string): string {
  const d = parseYMD(s);
  if (!d) return '';
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based offset (0 = Monday) */
function firstDayOffset(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
@keyframes dp-appear {
  from { opacity: 0; transform: scale(.96) translateY(-4px); }
  to   { opacity: 1; transform: scale(1)  translateY(0); }
}
@keyframes dp-slide-left {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes dp-slide-right {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}

.dp-popup {
  animation: dp-appear .18s cubic-bezier(.22,1,.36,1) both;
}
.dp-grid-animate-left  { animation: dp-slide-left  .15s cubic-bezier(.22,1,.36,1) both; }
.dp-grid-animate-right { animation: dp-slide-right .15s cubic-bezier(.22,1,.36,1) both; }

.dp-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--shell-border-strong);
  background: var(--shell-panel-strong);
  color: var(--text-h);
  cursor: pointer;
  font-size: 13px;
  font-family: var(--sans);
  transition: border-color .16s, box-shadow .16s, background .16s;
  outline: none;
  text-align: left;
  user-select: none;
  min-height: 38px;
}
.dp-trigger:hover:not(.dp-trigger--disabled) {
  border-color: rgba(37,99,235,.35);
}
.dp-trigger--open {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(37,99,235,.12);
}
.dp-trigger--disabled {
  opacity: .45;
  cursor: not-allowed;
}

.dp-day {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  font-family: 'Outfit', var(--sans);
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: background .12s, color .12s, transform .1s;
  user-select: none;
  flex-shrink: 0;
  border: none;
  outline: none;
}
.dp-day:hover:not(.dp-day--selected):not(.dp-day--disabled):not(.dp-day--outside) {
  background: rgba(37,99,235,.08);
  color: var(--accent);
  transform: scale(1.06);
}
.dp-day--today::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}
.dp-day--selected.dp-day--today::after { background: rgba(255,255,255,.7); }

.dp-day--selected {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(37,99,235,.35);
}
.dp-day--outside  { color: var(--muted); opacity: .35; pointer-events: none; }
.dp-day--disabled { opacity: .25; cursor: not-allowed; pointer-events: none; }

/* Range styles */
.dp-day--range-between {
  border-radius: 0;
  background: rgba(37,99,235,.08);
  color: var(--accent);
  font-weight: 600;
}
.dp-day--range-start {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(37,99,235,.35);
  border-radius: 50% 0 0 50%;
}
.dp-day--range-end {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(37,99,235,.35);
  border-radius: 0 50% 50% 0;
}
.dp-day--range-single {
  border-radius: 50%;
}
.dp-day--range-start.dp-day--range-single,
.dp-day--range-end.dp-day--range-single {
  border-radius: 50%;
}
.dp-day--hover-range {
  background: rgba(37,99,235,.05);
}
`;

// ── Inyector de estilos ───────────────────────────────────────────────────────

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ── Hook: posición del popup ──────────────────────────────────────────────────

function usePopupPosition(
  triggerRef: React.RefObject<HTMLElement>,
  open: boolean,
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupH = 320;
    const top = spaceBelow >= popupH
      ? rect.bottom + window.scrollY + 6
      : rect.top + window.scrollY - popupH - 6;
    setPos({
      top,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 290),
      width: Math.max(rect.width, 280),
    });
  }, [open, triggerRef]);

  return pos;
}

// ── Hook: cerrar al hacer click fuera ────────────────────────────────────────

function useClickOutside(
  refs: React.RefObject<HTMLElement>[],
  handler: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: MouseEvent) => {
      if (refs.every(r => r.current && !r.current.contains(e.target as Node))) {
        handler();
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [active, handler, refs]);
}

// ── CalendarIcon ──────────────────────────────────────────────────────────────

const CalendarIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const ChevronIcon: React.FC<{ dir: 'left' | 'right' }> = ({ dir }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'left'
      ? <polyline points="15 18 9 12 15 6" />
      : <polyline points="9 18 15 12 9 6" />
    }
  </svg>
);

// ── MonthGrid ─────────────────────────────────────────────────────────────────

interface MonthGridProps {
  year: number;
  month: number;
  selected?: Date | null;
  rangeFrom?: Date | null;
  rangeTo?: Date | null;
  hoverDate?: Date | null;
  minDate?: Date | null;
  maxDate?: Date | null;
  /** Fechas puntuales (YYYY-MM-DD) que no se pueden seleccionar, p.ej. noches sin disponibilidad */
  disabledDates?: Set<string>;
  onSelect: (d: Date) => void;
  onHover?: (d: Date | null) => void;
  direction?: 'left' | 'right' | null;
}

const MonthGrid: React.FC<MonthGridProps> = ({
  year, month, selected, rangeFrom, rangeTo, hoverDate,
  minDate, maxDate, disabledDates, onSelect, onHover, direction,
}) => {
  const offset = firstDayOffset(year, month);
  const total  = daysInMonth(year, month);
  const today  = new Date();

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const cls = direction
    ? `dp-grid-animate-${direction}`
    : '';

  return (
    <div className={cls} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', gap: '2px 0', justifyContent: 'center' }}>
      {cells.map((d, i) => {
        if (!d) return <div key={`empty-${i}`} style={{ width: 34, height: 34 }} />;

        const ymd    = toYMD(d);
        const isSelected = selected ? sameDay(d, selected) : false;
        const isToday    = sameDay(d, today);
        const isDisabled = !!((minDate && d < minDate) || (maxDate && d > maxDate) || disabledDates?.has(ymd));

        // Range logic
        const isRangeFrom  = rangeFrom ? sameDay(d, rangeFrom) : false;
        const isRangeTo    = rangeTo   ? sameDay(d, rangeTo)   : false;

        const effectiveTo  = rangeTo ?? hoverDate;
        const lo = rangeFrom && effectiveTo
          ? (rangeFrom < effectiveTo ? rangeFrom : effectiveTo)
          : null;
        const hi = rangeFrom && effectiveTo
          ? (rangeFrom < effectiveTo ? effectiveTo : rangeFrom)
          : null;
        const isBetween = lo && hi ? (d > lo && d < hi) : false;

        const isStart  = rangeFrom ? sameDay(d, rangeFrom) : false;
        const isEnd    = effectiveTo ? sameDay(d, effectiveTo) : false;
        const isSingle = isStart && isEnd;

        let dayClass = 'dp-day';
        if (isDisabled) {
          dayClass += ' dp-day--disabled';
        } else if (rangeFrom !== undefined) {
          // Range mode
          if (isSingle)       dayClass += ' dp-day--range-start dp-day--range-single';
          else if (isStart)   dayClass += ' dp-day--range-start';
          else if (isEnd)     dayClass += ' dp-day--range-end';
          else if (isBetween) dayClass += ' dp-day--range-between';
        } else if (isSelected) {
          dayClass += ' dp-day--selected';
        }

        if (isToday) dayClass += ' dp-day--today';

        return (
          <button
            key={ymd}
            className={dayClass}
            onClick={() => !isDisabled && onSelect(d)}
            onMouseEnter={() => onHover?.(d)}
            onMouseLeave={() => onHover?.(null)}
            tabIndex={isDisabled ? -1 : 0}
          >
            {d.getDate()}
          </button>
        );
      })}
    </div>
  );
};

// ── CalendarPopup ─────────────────────────────────────────────────────────────

interface CalendarPopupProps {
  style?: React.CSSProperties;
  year: number;
  month: number;
  onMonthChange: (y: number, m: number, dir: 'left' | 'right') => void;
  children: React.ReactNode;
}

const CalendarPopup: React.FC<CalendarPopupProps> = ({
  style, year, month, onMonthChange, children,
}) => (
  <div
    className="dp-popup"
    style={{
      position: 'absolute',
      zIndex: 99999,
      background: 'var(--shell-panel-strong)',
      border: '1px solid var(--shell-border-strong)',
      borderRadius: 16,
      padding: '16px 16px 14px',
      boxShadow: '0 8px 40px -8px rgba(15,23,42,.18), 0 2px 12px -4px rgba(15,23,42,.08)',
      width: 280,
      ...style,
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <button
        onClick={() => { const n = addMonths(year, month, -1); onMonthChange(n.year, n.month, 'right'); }}
        style={{
          width: 28, height: 28, borderRadius: 8, border: '1px solid var(--shell-border-strong)',
          background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .12s, color .12s',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).closest('button')!.style.background = 'var(--accent-bg)'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--accent)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).closest('button')!.style.background = 'transparent'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--muted)'; }}
      >
        <ChevronIcon dir="left" />
      </button>

      <span style={{
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: 'Outfit, var(--sans)',
        color: 'var(--text-h)',
        letterSpacing: '-.01em',
      }}>
        {MONTHS_ES[month]} {year}
      </span>

      <button
        onClick={() => { const n = addMonths(year, month, 1); onMonthChange(n.year, n.month, 'left'); }}
        style={{
          width: 28, height: 28, borderRadius: 8, border: '1px solid var(--shell-border-strong)',
          background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .12s, color .12s',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).closest('button')!.style.background = 'var(--accent-bg)'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--accent)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).closest('button')!.style.background = 'transparent'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--muted)'; }}
      >
        <ChevronIcon dir="right" />
      </button>
    </div>

    {/* Weekday headers */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 34px)',
      gap: '0',
      marginBottom: 6,
      justifyContent: 'center',
    }}>
      {WEEKDAYS.map(d => (
        <div key={d} style={{
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'Outfit, var(--sans)',
          color: 'var(--muted)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {d}
        </div>
      ))}
    </div>

    {children}
  </div>
);

// ── DatePicker ────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  /** Fechas puntuales (YYYY-MM-DD) deshabilitadas, p.ej. noches sin disponibilidad */
  disabledDates?: Set<string>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value = '',
  onChange,
  min,
  max,
  disabledDates,
  disabled = false,
  placeholder = 'Seleccionar fecha',
  className,
  style,
}) => {
  ensureStyles();

  const [open, setOpen]   = useState(false);
  const [dir, setDir]     = useState<'left' | 'right' | null>(null);
  const triggerRef        = useRef<HTMLButtonElement>(null);
  const popupRef          = useRef<HTMLDivElement>(null);
  const pos               = usePopupPosition(triggerRef, open);

  const selected = parseYMD(value);
  const minDate  = parseYMD(min);
  const maxDate  = parseYMD(max);

  const initial = selected ?? (minDate ?? new Date());
  const [curYear,  setCurYear]  = useState(initial.getFullYear());
  const [curMonth, setCurMonth] = useState(initial.getMonth());

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) { setCurYear(selected.getFullYear()); setCurMonth(selected.getMonth()); }
  }, [value]);

  const handleMonthChange = (y: number, m: number, d: 'left' | 'right') => {
    setDir(d);
    setTimeout(() => setDir(null), 200);
    setCurYear(y); setCurMonth(m);
  };

  const handleSelect = (d: Date) => {
    onChange?.(toYMD(d));
    setOpen(false);
  };

  useClickOutside([triggerRef, popupRef], () => setOpen(false), open);

  const triggerClass = [
    'dp-trigger',
    open ? 'dp-trigger--open' : '',
    disabled ? 'dp-trigger--disabled' : '',
    className ?? '',
  ].join(' ');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        style={style}
        onClick={() => !disabled && setOpen(p => !p)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon size={14} color={open ? 'var(--accent)' : 'var(--muted)'} />
        {value
          ? <span style={{ flex: 1 }}>{formatDisplay(value)}</span>
          : <span className="dp-trigger-placeholder" style={{ flex: 1, color: 'var(--muted)' }}>{placeholder}</span>
        }
        {value && (
          <span
            role="button"
            title="Limpiar"
            onClick={e => { e.stopPropagation(); onChange?.(''); }}
            style={{
              width: 16, height: 16, borderRadius: 4, background: 'var(--shell-border-subtle)',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, cursor: 'pointer', flexShrink: 0,
            }}
          >
            ✕
          </span>
        )}
      </button>

      {open && createPortal(
        <div ref={popupRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0 }}>
          <CalendarPopup
            style={{ top: pos.top, left: pos.left }}
            year={curYear}
            month={curMonth}
            onMonthChange={handleMonthChange}
          >
            <MonthGrid
              year={curYear}
              month={curMonth}
              selected={selected}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
              onSelect={handleSelect}
              direction={dir}
            />
          </CalendarPopup>
        </div>,
        document.body,
      )}
    </>
  );
};

// ── DateRangePicker ───────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  from?: string;
  to?: string;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
  minFrom?: string;
  /** Fechas puntuales (YYYY-MM-DD) deshabilitadas, p.ej. noches sin disponibilidad */
  disabledDates?: Set<string>;
  /** If true, minTo auto-locks to `from` date */
  autoMinTo?: boolean;
  disabledFrom?: boolean;
  disabledTo?: boolean;
  placeholderFrom?: string;
  placeholderTo?: string;
  style?: React.CSSProperties;
  className?: string;
  /** Layout direction */
  direction?: 'row' | 'column';
  gap?: number;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from = '',
  to = '',
  onFromChange,
  onToChange,
  minFrom,
  disabledDates,
  autoMinTo = true,
  disabledFrom = false,
  disabledTo = false,
  placeholderFrom = 'Fecha de entrada',
  placeholderTo   = 'Fecha de salida',
  style,
  className,
  direction = 'row',
  gap = 8,
}) => {
  ensureStyles();

  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [hoverDate,   setHoverDate]   = useState<Date | null>(null);
  const [dir, setDir] = useState<'left' | 'right' | null>(null);

  const fromRef  = useRef<HTMLButtonElement>(null);
  const toRef    = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const activeRef = activeField === 'from' ? fromRef : toRef;
  const pos = usePopupPosition(activeRef, activeField !== null);

  const fromDate = parseYMD(from);
  const toDate   = parseYMD(to);
  const minFromD = parseYMD(minFrom);
  const minToD   = autoMinTo ? (fromDate ?? minFromD) : minFromD;

  const initial  = fromDate ?? (minFromD ?? new Date());
  const [curYear,  setCurYear]  = useState(initial.getFullYear());
  const [curMonth, setCurMonth] = useState(initial.getMonth());

  const handleMonthChange = (y: number, m: number, d: 'left' | 'right') => {
    setDir(d);
    setTimeout(() => setDir(null), 200);
    setCurYear(y); setCurMonth(m);
  };

  const handleSelect = (d: Date) => {
    const ymd = toYMD(d);
    if (activeField === 'from') {
      onFromChange?.(ymd);
      // If selected from > current to, clear to
      if (toDate && d > toDate) onToChange?.('');
      setActiveField('to');
    } else {
      onToChange?.(ymd);
      setActiveField(null);
    }
    setHoverDate(null);
  };

  const close = useCallback(() => { setActiveField(null); setHoverDate(null); }, []);
  useClickOutside([fromRef, toRef, popupRef], close, activeField !== null);

  const open = activeField !== null;

  const fieldBtn = (
    field: 'from' | 'to',
    ref: React.RefObject<HTMLButtonElement>,
    val: string,
    placeholder: string,
    disabled: boolean,
  ) => {
    const isActive = activeField === field;
    return (
      <button
        ref={ref}
        type="button"
        className={[
          'dp-trigger',
          isActive ? 'dp-trigger--open' : '',
          disabled ? 'dp-trigger--disabled' : '',
        ].join(' ')}
        style={{ flex: 1, minWidth: 0 }}
        onClick={() => {
          if (disabled) return;
          setActiveField(prev => prev === field ? null : field);
          // Sync view to the relevant date
          const anchor = field === 'from' ? fromDate : toDate;
          if (anchor) { setCurYear(anchor.getFullYear()); setCurMonth(anchor.getMonth()); }
        }}
        disabled={disabled}
      >
        <CalendarIcon size={14} color={isActive ? 'var(--accent)' : 'var(--muted)'} />
        {val
          ? <span style={{ flex: 1, textAlign: 'left' }}>{formatDisplay(val)}</span>
          : <span style={{ flex: 1, color: 'var(--muted)', textAlign: 'left' }}>{placeholder}</span>
        }
        {val && (
          <span
            role="button"
            title="Limpiar"
            onClick={e => {
              e.stopPropagation();
              field === 'from' ? onFromChange?.('') : onToChange?.('');
            }}
            style={{
              width: 16, height: 16, borderRadius: 4, background: 'var(--shell-border-subtle)',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, cursor: 'pointer', flexShrink: 0,
            }}
          >✕</span>
        )}
      </button>
    );
  };

  return (
    <>
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: direction === 'column' ? 'column' : 'row',
          gap,
          alignItems: direction === 'row' ? 'center' : 'stretch',
          ...style,
        }}
      >
        {fieldBtn('from', fromRef, from, placeholderFrom, disabledFrom)}

        {direction === 'row' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)"
            strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}

        {fieldBtn('to', toRef, to, placeholderTo, disabledTo)}
      </div>

      {open && createPortal(
        <div ref={popupRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0 }}>
          <CalendarPopup
            style={{ top: pos.top, left: pos.left }}
            year={curYear}
            month={curMonth}
            onMonthChange={handleMonthChange}
          >
            {/* Range label */}
            <div style={{
              display: 'flex',
              gap: 4,
              marginBottom: 8,
              padding: '5px 8px',
              background: 'var(--shell-border-subtle)',
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--muted)',
              fontWeight: 600,
              fontFamily: 'Outfit, var(--sans)',
            }}>
              <span style={{ flex: 1, color: activeField === 'from' ? 'var(--accent)' : 'inherit' }}>
                {from ? formatDisplay(from) : 'Entrada'}
              </span>
              <span>→</span>
              <span style={{ flex: 1, textAlign: 'right', color: activeField === 'to' ? 'var(--accent)' : 'inherit' }}>
                {to ? formatDisplay(to) : 'Salida'}
              </span>
            </div>

            <MonthGrid
              year={curYear}
              month={curMonth}
              rangeFrom={fromDate}
              rangeTo={toDate}
              hoverDate={activeField === 'to' ? hoverDate : null}
              minDate={activeField === 'to' ? minToD : minFromD}
              disabledDates={disabledDates}
              onSelect={handleSelect}
              onHover={setHoverDate}
              direction={dir}
            />
          </CalendarPopup>
        </div>,
        document.body,
      )}
    </>
  );
};

export default DatePicker;
