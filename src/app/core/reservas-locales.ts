/**
 * Recuerda en este navegador con qué teléfono se hizo cada reserva, porque la API exige código + teléfono
 * para consultarla. Así un F5 o volver más tarde no obliga a escribirlo. Solo guarda los últimos 20.
 */
const CLAVE = 'alex-rifas:reservas';
const MAXIMO = 20;

function leer(): Record<string, string> {
  try {
    const dato: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    if (typeof dato !== 'object' || dato === null || Array.isArray(dato)) return {};
    return Object.fromEntries(Object.entries(dato).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function guardarTelefono(codigo: string, telefono: string): void {
  try {
    const todo = leer();
    delete todo[codigo]; // al reinsertar queda como la más reciente
    const entradas = [...Object.entries(todo), [codigo, telefono]].slice(-MAXIMO);
    localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(entradas)));
  } catch {
    /* almacenamiento bloqueado: la pantalla de reserva pedirá el teléfono */
  }
}

export function telefonoGuardado(codigo: string): string | null {
  return leer()[codigo] ?? null;
}
