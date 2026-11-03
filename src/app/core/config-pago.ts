/**
 * Datos de contacto y pago de esta instalación. La API todavía no los expone por rifa, así que viven aquí.
 * Rellénalos antes de publicar. Mientras `whatsapp` esté vacío, el botón de WhatsApp no se muestra.
 */
export const CONFIG_PAGO = {
  /** Celular del organizador con indicativo y sin signos, p. ej. '573001234567'. */
  whatsapp: '',
};

/** Solo acepta el formato de wa.me para Colombia: 57 + celular de 10 dígitos. */
export function whatsappValido(numero: string): boolean {
  return /^573\d{9}$/.test(numero);
}

export function enlaceWhatsapp(numero: string, texto: string): string | null {
  return whatsappValido(numero) ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}
