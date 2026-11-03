import { normalizarTelefono } from '../core/telefono';

/** Lo que se le manda a la API según lo que escribió la persona en el buscador. */
export type Busqueda =
  | { tipo: 'vacia' }
  | { tipo: 'telefono'; telefono: string }
  | { tipo: 'numero'; numero: number }
  | { tipo: 'invalida'; mensaje: string };

/**
 * Un solo cuadro para dos búsquedas: un celular colombiano válido (10 dígitos, con o sin +57) busca por
 * teléfono; hasta 5 dígitos buscan por número de boleto (ADR-06 admite hasta 4 cifras; "07" == 7).
 */
export function interpretarBusqueda(texto: string): Busqueda {
  const t = texto.trim();
  if (!t) return { tipo: 'vacia' };
  const telefono = normalizarTelefono(t);
  if (telefono) return { tipo: 'telefono', telefono };
  if (/^\d{1,5}$/.test(t)) return { tipo: 'numero', numero: Number(t) };
  return { tipo: 'invalida', mensaje: 'Escribe un número de boleto (ej. 07) o un celular de 10 dígitos.' };
}

/** "+573001234567" -> "300 123 4567" (el API entrega el prefijo; en pantalla sobra). */
export function telefonoParaMostrar(guardado: string | null): string {
  if (!guardado) return '';
  const d = guardado.replace(/\D/g, '');
  const diez = d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  return diez.length === 10 ? `${diez.slice(0, 3)} ${diez.slice(3, 6)} ${diez.slice(6)}` : guardado;
}

/** Enlace de WhatsApp (wa.me exige código de país y solo dígitos). */
export function enlaceWhatsapp(guardado: string | null, texto: string): string | null {
  if (!guardado) return null;
  const d = guardado.replace(/\D/g, '');
  const completo = d.length === 10 ? `57${d}` : d;
  return completo.length >= 11 ? `https://wa.me/${completo}?text=${encodeURIComponent(texto)}` : null;
}

export const METODOS_PAGO = ['Nequi', 'Daviplata', 'Bancolombia', 'Efectivo', 'Otro'] as const;
