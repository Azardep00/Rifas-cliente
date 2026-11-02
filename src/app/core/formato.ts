/** Formato para personas en Colombia: pesos sin decimales y fechas en hora de Bogotá (la rifa se juega allá). */

const ZONA = 'America/Bogota';

export function formatearMoneda(valor: number, moneda = 'COP'): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: moneda, maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    return `${new Intl.NumberFormat('es-CO').format(valor)} ${moneda}`;
  }
}

/** "domingo, 15 de noviembre de 2026, 10:00 a. m." */
export function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', timeZone: ZONA }).format(new Date(iso));
}

/** "15/11/2026, 10:00 a. m." (tarjetas del listado) */
export function formatearFechaHoraCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA }).format(new Date(iso));
}

/** 10000 -> "10.000" */
export function formatearEntero(n: number): string {
  return new Intl.NumberFormat('es-CO').format(n);
}

/** "15/11/2026" */
export function formatearFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: ZONA }).format(new Date(iso));
}

/** Porcentaje entero de números ya no libres (vendidos o reservados), entre 0 y 100. */
export function porcentajeOcupado(total: number, disponibles: number): number {
  if (total <= 0) return 0;
  const p = Math.round(((total - disponibles) / total) * 100);
  return Math.min(100, Math.max(0, p));
}

/** 15 -> "15 minutos", 60 -> "1 hora", 90 -> "1 hora y 30 minutos", 1440 -> "24 horas". */
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const horas = h === 1 ? '1 hora' : `${h} horas`;
  const mins = m === 1 ? '1 minuto' : `${m} minutos`;
  if (h === 0) return mins;
  return m === 0 ? horas : `${horas} y ${mins}`;
}

export function etiquetaEstadoRifa(estado: string): string {
  switch (estado) {
    case 'PUBLICADA': return 'Ventas abiertas';
    case 'CERRADA': return 'Ventas cerradas';
    case 'SORTEADA': return 'Sorteada';
    case 'CANCELADA': return 'Cancelada';
    case 'BORRADOR': return 'Borrador';
    default: return estado;
  }
}
