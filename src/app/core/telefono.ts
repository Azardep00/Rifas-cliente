/**
 * Celular colombiano, con las mismas reglas que `TelefonoColombia.normalizar` de la API:
 * se quitan espacios, guiones, paréntesis, puntos y "+"; un "57" delante (12 dígitos) se descarta;
 * deben quedar 10 dígitos que empiecen por 3 y no sean todos iguales.
 * Devuelve los 10 dígitos o `null` si no es válido.
 */
export function normalizarTelefono(texto: string): string | null {
  let digitos = texto.replace(/[\s\-().+]/g, '');
  if (digitos.startsWith('57') && digitos.length === 12) digitos = digitos.slice(2);
  if (!/^3\d{9}$/.test(digitos) || /^(\d)\1{9}$/.test(digitos)) return null;
  return digitos;
}

/** "3001234567" -> "300 123 4567" */
export function formatearTelefono(diezDigitos: string): string {
  return `${diezDigitos.slice(0, 3)} ${diezDigitos.slice(3, 6)} ${diezDigitos.slice(6)}`;
}

/** Igual que el servidor: sin espacios repetidos en los bordes ni dentro. */
export function limpiarNombre(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}
