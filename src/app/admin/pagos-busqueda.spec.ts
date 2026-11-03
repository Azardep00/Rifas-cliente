import { describe, expect, it } from 'vitest';
import { enlaceWhatsapp, interpretarBusqueda, telefonoParaMostrar } from './pagos-busqueda';

describe('pagos-busqueda', () => {
  it('vacío no filtra', () => expect(interpretarBusqueda('   ')).toEqual({ tipo: 'vacia' }));

  it('un celular válido busca por teléfono, con o sin +57 y con espacios', () => {
    expect(interpretarBusqueda('300 123 4567')).toEqual({ tipo: 'telefono', telefono: '3001234567' });
    expect(interpretarBusqueda('+57 300 123 4567')).toEqual({ tipo: 'telefono', telefono: '3001234567' });
  });

  it('pocos dígitos buscan por número de boleto e ignoran ceros a la izquierda', () => {
    expect(interpretarBusqueda('07')).toEqual({ tipo: 'numero', numero: 7 });
    expect(interpretarBusqueda('1234')).toEqual({ tipo: 'numero', numero: 1234 });
  });

  it('texto raro o celulares incompletos son inválidos', () => {
    expect(interpretarBusqueda('ana').tipo).toBe('invalida');
    expect(interpretarBusqueda('300123').tipo).toBe('invalida');
  });

  it('formatea el teléfono guardado y arma WhatsApp', () => {
    expect(telefonoParaMostrar('+573001234567')).toBe('300 123 4567');
    expect(telefonoParaMostrar(null)).toBe('');
    expect(enlaceWhatsapp('+573001234567', 'Hola ana')).toBe('https://wa.me/573001234567?text=Hola%20ana');
    expect(enlaceWhatsapp(null, 'x')).toBeNull();
  });
});
