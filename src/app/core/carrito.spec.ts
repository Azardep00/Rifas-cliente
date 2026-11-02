import { TestBed } from '@angular/core/testing';
import { Carrito, ConfigCarrito, formatearDinero } from './carrito';

const RIFA: ConfigCarrito = { codigo: 'R1', precio: 10000, moneda: 'COP', maximo: 3, digitos: 3 };

describe('Carrito', () => {
  let carrito: Carrito;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    carrito = TestBed.inject(Carrito);
    carrito.configurar(RIFA);
  });

  it('agrega y quita números, siempre ordenados', () => {
    expect(carrito.alternar(42)).toBe('agregado');
    expect(carrito.alternar(7)).toBe('agregado');
    expect(carrito.numeros()).toEqual([7, 42]);
    expect(carrito.alternar(42)).toBe('quitado');
    expect(carrito.numeros()).toEqual([7]);
  });

  it('calcula el total con precio × cantidad', () => {
    carrito.alternar(1);
    carrito.alternar(2);
    expect(carrito.cantidad()).toBe(2);
    expect(carrito.total()).toBe(20000);
  });

  it('respeta el máximo por reserva pero deja quitar estando lleno', () => {
    [1, 2, 3].forEach((n) => carrito.alternar(n));
    expect(carrito.lleno()).toBe(true);
    expect(carrito.alternar(4)).toBe('lleno');
    expect(carrito.numeros()).toEqual([1, 2, 3]);
    expect(carrito.alternar(2)).toBe('quitado');
    expect(carrito.lleno()).toBe(false);
  });

  it('sin rifa configurada no agrega nada', () => {
    TestBed.resetTestingModule();
    expect(TestBed.inject(Carrito).alternar(5)).toBe('sin-rifa');
  });

  it('reconciliar saca los números que dejaron de estar libres y los devuelve', () => {
    [1, 2, 3].forEach((n) => carrito.alternar(n));
    // posición:    0   1   2   3
    const quitados = carrito.reconciliar('LLRV');
    expect(quitados).toEqual([2, 3]);
    expect(carrito.numeros()).toEqual([1]);
  });

  it('reconciliar también saca números fuera de rango', () => {
    carrito.alternar(50);
    expect(carrito.reconciliar('LLL')).toEqual([50]);
  });

  it('reconciliar sin cambios no devuelve nada', () => {
    carrito.alternar(0);
    expect(carrito.reconciliar('LRV')).toEqual([]);
    expect(carrito.numeros()).toEqual([0]);
  });

  it('recupera la selección tras recargar la página (misma rifa)', () => {
    carrito.alternar(9);
    carrito.alternar(4);
    TestBed.resetTestingModule();
    const nuevo = TestBed.inject(Carrito);
    nuevo.configurar(RIFA);
    expect(nuevo.numeros()).toEqual([4, 9]);
  });

  it('al cambiar de rifa vacía el carrito: no se mezclan números', () => {
    carrito.alternar(9);
    carrito.configurar({ ...RIFA, codigo: 'R2' });
    expect(carrito.numeros()).toEqual([]);
    carrito.configurar(RIFA);
    expect(carrito.numeros()).toEqual([]);
  });

  it('si la rifa baja el máximo, recorta la selección guardada', () => {
    [1, 2, 3].forEach((n) => carrito.alternar(n));
    carrito.configurar({ ...RIFA, maximo: 2 });
    expect(carrito.numeros()).toEqual([1, 2]);
  });

  it('ignora un almacén corrupto o de otra rifa', () => {
    sessionStorage.setItem('alex-rifas:carrito', '{no es json');
    TestBed.resetTestingModule();
    const a = TestBed.inject(Carrito);
    a.configurar(RIFA);
    expect(a.numeros()).toEqual([]);

    sessionStorage.setItem('alex-rifas:carrito', JSON.stringify({ codigo: 'OTRA', numeros: [1, 2] }));
    TestBed.resetTestingModule();
    const b = TestBed.inject(Carrito);
    b.configurar(RIFA);
    expect(b.numeros()).toEqual([]);
  });

  it('descarta valores no válidos del almacén', () => {
    sessionStorage.setItem('alex-rifas:carrito', JSON.stringify({ codigo: 'R1', numeros: [3, 3, -1, 'x', 1.5, 1] }));
    TestBed.resetTestingModule();
    const c = TestBed.inject(Carrito);
    c.configurar(RIFA);
    expect(c.numeros()).toEqual([1, 3]);
  });

  it('vaciar limpia selección y almacén', () => {
    carrito.alternar(1);
    carrito.vaciar();
    expect(carrito.numeros()).toEqual([]);
    expect(sessionStorage.getItem('alex-rifas:carrito')).toBeNull();
  });
});

describe('formatearDinero', () => {
  it('da formato colombiano sin decimales', () => {
    expect(formatearDinero(30000, 'COP').replace(/\s/g, '')).toBe('$30.000');
  });
  it('con una moneda inválida no lanza', () => {
    expect(formatearDinero(5, 'XX')).toContain('5');
  });
});
