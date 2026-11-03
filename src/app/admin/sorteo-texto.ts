import { formatearFechaCorta } from '../core/formato';
import { PasoLoteria, ReglaVacante } from '../core/api/models';

/** Textos del sorteo por lotería, en lenguaje claro para quien lo ejecuta desde el celular. Lógica pura (con spec). */

export function etiquetaRegla(r: ReglaVacante): string {
  return r === 'REPETIR_SIGUIENTE_LOTERIA'
    ? 'Si el número no se vendió, se usa el siguiente sorteo de la lotería'
    : 'Si el número no se vendió, gana el siguiente número vendido';
}

/** Una línea por paso: qué salió en la lotería y qué pasó con ese número. */
export function describirPaso(p: PasoLoteria): string {
  const sale = `Salió ${p.numeroMayor} → terminación ${p.numeroObjetivo}`;
  if (p.resolucion === 'DIRECTO') return `${sale}: gana el ${p.numeroBoleto}.`;
  const motivo = p.causa === 'YA_GANO_OTRO_PREMIO' ? 'ya ganó otro premio' : 'no se vendió';
  if (p.resolucion === 'ADJUDICADO_SIGUIENTE_VENDIDO') return `${sale}, ${motivo}: pasa al siguiente vendido, el ${p.numeroBoleto}.`;
  return `${sale}, ${motivo}: se repite con el siguiente sorteo.`;
}

/** Colores semánticos por resolución, para no depender solo del texto. */
export function claseResolucion(p: PasoLoteria): 'ok' | 'aviso' | 'repite' {
  return p.resolucion === 'DIRECTO' ? 'ok' : p.resolucion === 'REPETIDO' ? 'repite' : 'aviso';
}

/** Los sorteos de lotería traen fecha sin hora ("2026-11-05"); se fija al mediodía de Colombia para que no retroceda un día. */
export function diaLoteria(fecha: string): string {
  return formatearFechaCorta(`${fecha.slice(0, 10)}T12:00:00-05:00`);
}
