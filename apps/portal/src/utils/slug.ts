export function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function formatearFecha(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-HN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export function calcularNoches(checkIn: string, checkOut: string): number {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86_400_000));
}

export function formatMoneda(valor: number, moneda = 'HNL'): string {
  const simbolo = moneda === 'USD' ? '$' : 'L';
  return `${simbolo} ${valor.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
