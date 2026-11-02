/** Utilidades de números de boleto (ADR-06: se muestran con ceros a la izquierda: 07, 042, 0042). */

export type EstadoNumero = 'libre' | 'reservado' | 'vendido';

/** 7 con 2 dígitos -> "07". Sin `digitos` (rifa que no es por lotería) se muestra tal cual. */
export function formatearNumero(numero: number, digitos?: number | null): string {
  return digitos ? String(numero).padStart(digitos, '0') : String(numero);
}

/** Convierte `GrillaBoletos.estados` (L/R/V por posición) en una lista de estados por número. */
export function decodificarGrilla(estados: string): EstadoNumero[] {
  return Array.from(estados, (c) => {
    switch (c) {
      case 'L': return 'libre';
      case 'R': return 'reservado';
      case 'V': return 'vendido';
      default: throw new Error(`Estado de boleto desconocido en la grilla: "${c}"`);
    }
  });
}

/** Una rifa por lotería exige cantidad = 10^dígitos (100, 1000, 10 000). */
export function cantidadValidaPorLoteria(cantidad: number, digitos: number): boolean {
  return [2, 3, 4].includes(digitos) && cantidad === 10 ** digitos;
}
