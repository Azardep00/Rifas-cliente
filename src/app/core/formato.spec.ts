import {
  etiquetaEstadoRifa, formatearDuracion, formatearEntero, formatearFechaHora, formatearFechaHoraCorta, formatearMoneda,
  porcentajeOcupado,
} from './formato';

describe('porcentajeOcupado', () => {
  it('calcula el porcentaje de números no libres', () => {
    expect(porcentajeOcupado(100, 75)).toBe(25);
    expect(porcentajeOcupado(1000, 0)).toBe(100);
    expect(porcentajeOcupado(1000, 1000)).toBe(0);
  });
  it('no se sale de 0 a 100 ni divide por cero', () => {
    expect(porcentajeOcupado(0, 0)).toBe(0);
    expect(porcentajeOcupado(100, -5)).toBe(100);
    expect(porcentajeOcupado(100, 150)).toBe(0);
  });
});

describe('formatearDuracion', () => {
  it('usa minutos, horas o ambos', () => {
    expect(formatearDuracion(15)).toBe('15 minutos');
    expect(formatearDuracion(1)).toBe('1 minuto');
    expect(formatearDuracion(60)).toBe('1 hora');
    expect(formatearDuracion(90)).toBe('1 hora y 30 minutos');
    expect(formatearDuracion(1440)).toBe('24 horas');
  });
});

describe('formatearMoneda', () => {
  it('formatea pesos colombianos sin decimales', () => {
    const t = formatearMoneda(10000, 'COP');
    expect(t).toContain('10.000');
    expect(t).not.toContain(',');
  });
  it('no rompe con una moneda inválida', () => {
    expect(formatearMoneda(5, 'XX')).toContain('5');
  });
});

describe('formatearFechaHora', () => {
  it('muestra la hora de Bogotá (UTC-5)', () => {
    const t = formatearFechaHora('2026-11-15T15:00:00Z');
    expect(t).toContain('15');
    expect(t).toContain('10:00');
  });
});

describe('etiquetaEstadoRifa', () => {
  it('traduce los estados a lenguaje de persona', () => {
    expect(etiquetaEstadoRifa('PUBLICADA')).toBe('Ventas abiertas');
    expect(etiquetaEstadoRifa('SORTEADA')).toBe('Sorteada');
  });
});

describe('formatearEntero y fecha corta', () => {
  it('separa miles con punto', () => {
    expect(formatearEntero(10000)).toBe('10.000');
    expect(formatearEntero(75)).toBe('75');
  });
  it('la fecha corta no incluye el día de la semana y usa hora de Bogotá', () => {
    const t = formatearFechaHoraCorta('2026-11-15T15:00:00Z');
    expect(t).not.toMatch(/domingo/i);
    expect(t).toContain('10:00');
  });
});
