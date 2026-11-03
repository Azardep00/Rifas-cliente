import { CONFIG_PAGO, enlaceWhatsapp, whatsappValido } from './config-pago';
import { guardarTelefono, telefonoGuardado } from './reservas-locales';

describe('reservas-locales', () => {
  beforeEach(() => localStorage.clear());

  it('guarda y recupera el teléfono por código', () => {
    guardarTelefono('A', '3001234567');
    expect(telefonoGuardado('A')).toBe('3001234567');
    expect(telefonoGuardado('B')).toBeNull();
  });
  it('conserva solo las 20 más recientes', () => {
    for (let i = 0; i < 25; i++) guardarTelefono(`R${i}`, '3001234567');
    expect(telefonoGuardado('R0')).toBeNull();
    expect(telefonoGuardado('R4')).toBeNull();
    expect(telefonoGuardado('R5')).toBe('3001234567');
    expect(telefonoGuardado('R24')).toBe('3001234567');
  });
  it('un almacén corrupto no rompe nada', () => {
    localStorage.setItem('alex-rifas:reservas', '{mal');
    expect(telefonoGuardado('A')).toBeNull();
    localStorage.setItem('alex-rifas:reservas', '[1,2]');
    expect(telefonoGuardado('A')).toBeNull();
    guardarTelefono('A', '3001234567');
    expect(telefonoGuardado('A')).toBe('3001234567');
  });
});

describe('config-pago', () => {
  it('whatsapp solo acepta 57 + celular de 10 dígitos', () => {
    expect(whatsappValido('573001234567')).toBe(true);
    for (const mal of ['', '3001234567', '+573001234567', '572001234567', '57300123456']) expect(whatsappValido(mal)).toBe(false);
  });
  it('el enlace codifica el mensaje y sin número válido no hay enlace', () => {
    expect(enlaceWhatsapp('573001234567', 'Hola & más')).toBe('https://wa.me/573001234567?text=Hola%20%26%20m%C3%A1s');
    expect(enlaceWhatsapp('', 'Hola')).toBeNull();
  });
  it('por defecto no hay número (hay que configurarlo antes de publicar)', () => {
    expect(CONFIG_PAGO.whatsapp).toBe('');
  });
});
