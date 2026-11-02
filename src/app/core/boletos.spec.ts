import { cantidadValidaPorLoteria, decodificarGrilla, formatearNumero } from './boletos';

describe('formatearNumero', () => {
  it('rellena con ceros a la izquierda según los dígitos de la rifa', () => {
    expect(formatearNumero(7, 2)).toBe('07');
    expect(formatearNumero(42, 3)).toBe('042');
    expect(formatearNumero(0, 4)).toBe('0000');
    expect(formatearNumero(9999, 4)).toBe('9999');
  });
  it('sin dígitos muestra el número tal cual', () => {
    expect(formatearNumero(7)).toBe('7');
    expect(formatearNumero(7, null)).toBe('7');
  });
});

describe('decodificarGrilla', () => {
  it('traduce L, R y V respetando la posición', () => {
    expect(decodificarGrilla('LRV')).toEqual(['libre', 'reservado', 'vendido']);
  });
  it('acepta una grilla vacía', () => {
    expect(decodificarGrilla('')).toEqual([]);
  });
  it('falla ruidosamente con un carácter desconocido', () => {
    expect(() => decodificarGrilla('LX')).toThrow(/desconocido/);
  });
});

describe('cantidadValidaPorLoteria', () => {
  it('solo acepta 10^dígitos con 2, 3 o 4 dígitos', () => {
    expect(cantidadValidaPorLoteria(100, 2)).toBe(true);
    expect(cantidadValidaPorLoteria(1000, 3)).toBe(true);
    expect(cantidadValidaPorLoteria(10000, 4)).toBe(true);
    expect(cantidadValidaPorLoteria(500, 3)).toBe(false);
    expect(cantidadValidaPorLoteria(10, 1)).toBe(false);
  });
});
