import { formatearCuentaRegresiva } from './cuenta-regresiva';

describe('formatearCuentaRegresiva', () => {
  it('minutos y segundos con ceros', () => {
    expect(formatearCuentaRegresiva(872_000)).toBe('14:32');
    expect(formatearCuentaRegresiva(5_000)).toBe('00:05');
  });
  it('con horas usa h:mm:ss', () => {
    expect(formatearCuentaRegresiva(3_725_000)).toBe('1:02:05');
    expect(formatearCuentaRegresiva(3_600_000)).toBe('1:00:00');
  });
  it('redondea hacia arriba: no marca 00:00 hasta que se acabe', () => {
    expect(formatearCuentaRegresiva(1)).toBe('00:01');
    expect(formatearCuentaRegresiva(999)).toBe('00:01');
  });
  it('cero y negativos se quedan en 00:00', () => {
    expect(formatearCuentaRegresiva(0)).toBe('00:00');
    expect(formatearCuentaRegresiva(-5000)).toBe('00:00');
  });
});
