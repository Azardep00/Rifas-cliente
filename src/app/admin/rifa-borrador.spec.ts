import { describe, expect, it } from 'vitest';
import { BORRADOR_VACIO, Borrador, aInstante, aPremiosRequest, aRifaRequest, numeroDe, validarDatos, validarPremios, validarSorteo } from './rifa-borrador';

const AHORA = new Date('2026-11-03T12:00:00Z');
const bueno = (): Borrador => ({
  ...BORRADOR_VACIO, titulo: 'Moto 0 km', precio: '5.000', cantidad: '100', maxPorCompra: '10',
  cierreVentas: '2026-11-20T18:00', fechaSorteo: '2026-11-21T22:00', loteriaId: 3,
  premios: [{ nombre: 'Moto', descripcion: '', valor: '9.000.000' }, { nombre: '', descripcion: '', valor: '' }],
});

describe('rifa-borrador', () => {
  it('numeroDe entiende puntos de miles y vacío', () => {
    expect(numeroDe('1.500')).toBe(1500);
    expect(numeroDe('1500,5')).toBe(1500.5);
    expect(numeroDe('')).toBeNaN();
  });

  it('aInstante interpreta hora de Bogotá (UTC-5)', () => {
    expect(aInstante('2026-11-20T18:00')).toBe('2026-11-20T23:00:00.000Z');
    expect(aInstante('mal')).toBeNull();
  });

  it('un borrador correcto no tiene errores', () => {
    const b = bueno();
    expect(validarDatos(b, AHORA)).toEqual({});
    expect(validarPremios(b)).toEqual({});
    expect(validarSorteo(b)).toEqual({});
  });

  it('rechaza fechas invertidas, pasadas y reserva fuera de rango', () => {
    const b = { ...bueno(), cierreVentas: '2026-11-01T10:00', fechaSorteo: '2026-10-30T10:00', reservaMinutos: '2' };
    const e = validarDatos(b, AHORA);
    expect(e['cierreVentas']).toBeDefined();
    expect(e['fechaSorteo']).toBeDefined();
    expect(e['reservaMinutos']).toBeDefined();
  });

  it('máximo por compra no puede superar la cantidad', () => {
    expect(validarDatos({ ...bueno(), cantidad: '20', maxPorCompra: '30' }, AHORA)['maxPorCompra']).toBeDefined();
  });

  it('con lotería exige catálogo y cantidad = 10^dígitos', () => {
    const e = validarSorteo({ ...bueno(), loteriaId: null, digitos: 3 });
    expect(e['loteria']).toBeDefined();
    expect(e['digitos']).toContain('1000');
    expect(validarSorteo({ ...bueno(), metodo: 'ALEATORIO', loteriaId: null, digitos: 3 })).toEqual({});
  });

  it('pide al menos un premio y detecta valor inválido', () => {
    expect(validarPremios({ ...bueno(), premios: [{ nombre: '', descripcion: '', valor: '' }] })['premios']).toBeDefined();
    expect(validarPremios({ ...bueno(), premios: [{ nombre: 'X', descripcion: '', valor: 'abc' }] })['premio0']).toBeDefined();
  });

  it('arma el cuerpo de la API: lotería solo con método LOTERIA y premios numerados', () => {
    const r = aRifaRequest(bueno());
    expect(r).toMatchObject({ precioBoleto: 5000, cantidadBoletos: 100, loteriaId: 3, digitos: 2, metodoSorteo: 'LOTERIA', moneda: 'COP' });
    const a = aRifaRequest({ ...bueno(), metodo: 'ALEATORIO' });
    expect(a.loteriaId).toBeUndefined();
    expect(a.digitos).toBeUndefined();
    expect(aPremiosRequest(bueno())).toEqual([{ posicion: 1, nombre: 'Moto', descripcion: undefined, valorEstimado: 9000000 }]);
  });
});
