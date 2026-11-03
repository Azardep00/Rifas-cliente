import { MetodoSorteo, PremioRequest, ReglaVacante, RifaRequest } from '../core/api/models';

/** Lo que el organizador escribe en el wizard. Todo texto: así los campos del celular no pelean con los números. */
export interface Borrador {
  titulo: string;
  descripcion: string;
  imagenUrl: string;
  precio: string;
  cantidad: string;
  maxPorCompra: string;
  cierreVentas: string; // datetime-local, hora de Bogotá
  fechaSorteo: string;
  reservaMinutos: string;
  metodo: MetodoSorteo;
  loteriaId: number | null;
  digitos: 2 | 3 | 4;
  reglaVacante: ReglaVacante;
  numeroAutorizacion: string;
  entidadAutorizadora: string;
  premios: PremioBorrador[];
}

export interface PremioBorrador {
  nombre: string;
  descripcion: string;
  valor: string;
}

export const BORRADOR_VACIO: Borrador = {
  titulo: '', descripcion: '', imagenUrl: '', precio: '', cantidad: '100', maxPorCompra: '10',
  cierreVentas: '', fechaSorteo: '', reservaMinutos: '60', metodo: 'LOTERIA', loteriaId: null, digitos: 2,
  reglaVacante: 'REPETIR_SIGUIENTE_LOTERIA', numeroAutorizacion: '', entidadAutorizadora: '', premios: [{ nombre: '', descripcion: '', valor: '' }],
};

export type Errores = Record<string, string>;

/** "1.500", "1500" o "1 500" -> 1500; vacío o inválido -> NaN. */
export function numeroDe(texto: string): number {
  const limpio = texto.replace(/[\s.]/g, '').replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

/** datetime-local ("2026-11-20T18:00") en hora de Colombia (UTC-5, sin horario de verano) -> ISO UTC. */
export function aInstante(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Paso 1: datos básicos y fechas (mismas reglas que RifaService.validarRifa). */
export function validarDatos(b: Borrador, ahora = new Date()): Errores {
  const e: Errores = {};
  const titulo = b.titulo.trim();
  if (!titulo) e['titulo'] = 'Escribe un título.';
  else if (titulo.length > 120) e['titulo'] = 'Máximo 120 caracteres.';
  if (b.descripcion.length > 4000) e['descripcion'] = 'Máximo 4000 caracteres.';
  if (b.imagenUrl.trim() && !/^https:\/\/\S+$/i.test(b.imagenUrl.trim())) e['imagenUrl'] = 'Debe ser un enlace que empiece por https://';
  const precio = numeroDe(b.precio);
  if (!(precio > 0)) e['precio'] = 'Escribe un precio mayor que cero.';
  const cantidad = numeroDe(b.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 10 || cantidad > 50000) e['cantidad'] = 'Entre 10 y 50.000 boletos.';
  const max = numeroDe(b.maxPorCompra);
  if (!Number.isInteger(max) || max < 1) e['maxPorCompra'] = 'Al menos 1.';
  else if (Number.isInteger(cantidad) && max > cantidad) e['maxPorCompra'] = 'No puede superar la cantidad de boletos.';
  const reserva = numeroDe(b.reservaMinutos);
  if (!Number.isInteger(reserva) || reserva < 5 || reserva > 1440) e['reservaMinutos'] = 'Entre 5 y 1440 minutos.';
  const cierre = aInstante(b.cierreVentas);
  const sorteo = aInstante(b.fechaSorteo);
  if (!cierre) e['cierreVentas'] = 'Elige fecha y hora de cierre.';
  else if (new Date(cierre) <= ahora) e['cierreVentas'] = 'El cierre debe ser una fecha futura.';
  if (!sorteo) e['fechaSorteo'] = 'Elige fecha y hora del sorteo.';
  else if (cierre && new Date(sorteo) <= new Date(cierre)) e['fechaSorteo'] = 'El sorteo debe ser después del cierre de ventas.';
  return e;
}

/** Paso 2: premios. Solo se evalúan los que tienen algo escrito; para publicar hace falta al menos uno. */
export function validarPremios(b: Borrador): Errores {
  const e: Errores = {};
  const usados = b.premios.map((p, i) => ({ p, i })).filter(({ p }) => p.nombre.trim() || p.descripcion.trim() || p.valor.trim());
  if (usados.length === 0) e['premios'] = 'Agrega al menos un premio.';
  for (const { p, i } of usados) {
    if (!p.nombre.trim()) e[`premio${i}`] = 'Falta el nombre del premio.';
    else if (p.nombre.trim().length > 120) e[`premio${i}`] = 'Nombre de máximo 120 caracteres.';
    else if (p.valor.trim() && !(numeroDe(p.valor) >= 0)) e[`premio${i}`] = 'El valor estimado no es válido.';
  }
  return e;
}

/** Paso 3: sorteo. Con LOTERIA, la cantidad de boletos debe ser exactamente 10^dígitos (ADR-06). */
export function validarSorteo(b: Borrador): Errores {
  const e: Errores = {};
  if (b.metodo === 'LOTERIA') {
    if (b.loteriaId === null) e['loteria'] = 'Elige la lotería.';
    if (numeroDe(b.cantidad) !== 10 ** b.digitos) e['digitos'] = `Con ${b.digitos} dígitos la rifa debe tener ${10 ** b.digitos} boletos.`;
  }
  if (b.numeroAutorizacion.length > 60) e['numeroAutorizacion'] = 'Máximo 60 caracteres.';
  if (b.entidadAutorizadora.length > 120) e['entidadAutorizadora'] = 'Máximo 120 caracteres.';
  return e;
}

export function validarTodo(b: Borrador, ahora = new Date()): Errores {
  return { ...validarDatos(b, ahora), ...validarPremios(b), ...validarSorteo(b) };
}

/** Construye el cuerpo del POST. Asume que validarDatos y validarSorteo pasaron. */
export function aRifaRequest(b: Borrador): RifaRequest {
  const lot = b.metodo === 'LOTERIA';
  const opc = (t: string) => (t.trim() ? t.trim() : undefined);
  return {
    titulo: b.titulo.trim(),
    descripcion: opc(b.descripcion),
    imagenUrl: opc(b.imagenUrl),
    precioBoleto: numeroDe(b.precio),
    moneda: 'COP',
    cantidadBoletos: numeroDe(b.cantidad),
    fechaSorteo: aInstante(b.fechaSorteo)!,
    cierreVentasEn: aInstante(b.cierreVentas)!,
    maximoBoletosPorCompra: numeroDe(b.maxPorCompra),
    metodoSorteo: b.metodo,
    numeroAutorizacion: opc(b.numeroAutorizacion),
    entidadAutorizadora: opc(b.entidadAutorizadora),
    loteriaId: lot ? (b.loteriaId ?? undefined) : undefined,
    digitos: lot ? b.digitos : undefined,
    reglaVacante: lot ? b.reglaVacante : undefined,
    reservaMinutos: numeroDe(b.reservaMinutos),
  };
}

/** Premios con algo escrito, numerados 1..n en el orden en que están. */
export function aPremiosRequest(b: Borrador): PremioRequest[] {
  return b.premios
    .filter((p) => p.nombre.trim())
    .map((p, i) => ({
      posicion: i + 1,
      nombre: p.nombre.trim(),
      descripcion: p.descripcion.trim() || undefined,
      valorEstimado: p.valor.trim() ? numeroDe(p.valor) : undefined,
    }));
}
