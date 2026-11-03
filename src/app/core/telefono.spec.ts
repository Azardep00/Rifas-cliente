import { formatearTelefono, limpiarNombre, normalizarTelefono } from './telefono';

describe('normalizarTelefono (mismas reglas que la API)', () => {
  it('acepta los formatos habituales y devuelve 10 dígitos', () => {
    for (const ok of ['3001234567', '300 123 4567', '(300) 123-4567', '+57 300 123 4567', '573001234567', '300.123.4567']) {
      expect(normalizarTelefono(ok)).toBe('3001234567');
    }
  });
  it('rechaza fijos, longitudes incorrectas y letras', () => {
    for (const mal of ['', '2001234567', '300123456', '30012345678', 'abc', '601 234 5678', '+1 300 123 4567']) {
      expect(normalizarTelefono(mal)).toBeNull();
    }
  });
  it('rechaza los 10 dígitos iguales', () => {
    expect(normalizarTelefono('3333333333')).toBeNull();
  });
  it('un "57" delante solo se descarta si el total es de 12 dígitos', () => {
    expect(normalizarTelefono('5712345678')).toBeNull();
  });
});

describe('formatearTelefono y limpiarNombre', () => {
  it('agrupa 3-3-4', () => expect(formatearTelefono('3001234567')).toBe('300 123 4567'));
  it('limpia espacios en los bordes y repetidos', () => expect(limpiarNombre('  Ana   María  Gómez ')).toBe('Ana María Gómez'));
});
