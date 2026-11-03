import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { CONFIG_PAGO } from '../core/config-pago';
import { guardarTelefono, telefonoGuardado } from '../core/reservas-locales';
import { detalle } from './pruebas';
import { INTERVALO_RESERVA_MS, Reserva } from './reserva';

const AHORA = new Date('2026-11-02T15:00:00Z');

const reserva = (o: Record<string, unknown> = {}) => ({
  codigo: 'ABC123', codigoRifa: 'R-001', estado: 'PENDIENTE', numeros: [7, 42], subtotal: 20000, moneda: 'COP',
  compradorNombre: 'Ana Gómez', telefonoEnmascarado: '+57 300 ••• 4567', creadaEn: '2026-11-02T15:00:00Z',
  expiraEn: '2026-11-02T15:15:00Z', ...o,
});

describe('Reserva (estado de la reserva)', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<Reserva>;
  const el = () => f.nativeElement as HTMLElement;
  const texto = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const URL_RESERVA = (r: { url: string; params: { get(k: string): string | null } }) => r.url === '/api/publico/reservas/ABC123';
  const asentar = async () => { await vi.advanceTimersByTimeAsync(0); f.detectChanges(); };

  /** Monta la pantalla; `telefono` simula el que quedó guardado al reservar. */
  async function montar(telefono: string | null = '3001234567', respuesta: object | null = reserva()) {
    localStorage.clear();
    if (telefono) guardarTelefono('ABC123', telefono);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Reserva);
    f.componentRef.setInput('codigo', 'ABC123');
    f.detectChanges();
    TestBed.tick();
    if (telefono && respuesta) {
      http.expectOne(URL_RESERVA).flush(respuesta);
      await asentar();
      http.expectOne('/api/rifas/R-001').flush(detalle({ titulo: 'Moto 0 km', digitos: 3 }));
      await asentar();
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(AHORA);
    CONFIG_PAGO.whatsapp = '';
  });
  afterEach(() => {
    CONFIG_PAGO.whatsapp = '';
    vi.useRealTimers();
  });

  it('consulta con código + el teléfono recordado y muestra números con ceros, total y estado', async () => {
    await montar();
    expect(texto()).toContain('Pendiente de pago');
    expect(texto()).toContain('007');
    expect(texto()).toContain('042');
    expect(texto()).toContain('Moto 0 km');
    expect(texto()).toMatch(/Total\s*\$\s*20\.000/);
    expect(texto()).toContain('+57 300 ••• 4567');
    expect(texto()).toContain('ABC123');
  });

  it('muestra «Vence el …» sin doble punto (la fecha ya termina en «p. m.»)', async () => {
    await montar();
    expect(texto()).toContain('Vence el');
    expect(texto()).not.toContain('..');
  });

  it('envía el teléfono como parámetro de la consulta', async () => {
    localStorage.clear();
    guardarTelefono('ABC123', '3001234567');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Reserva);
    f.componentRef.setInput('codigo', 'ABC123');
    f.detectChanges();
    TestBed.tick();
    const req = http.expectOne(URL_RESERVA);
    expect(req.request.params.get('telefono')).toBe('3001234567');
    req.flush(reserva());
    await asentar();
    http.expectOne('/api/rifas/R-001').flush(detalle());
  });

  it('la cuenta regresiva baja cada segundo hasta vencer', async () => {
    await montar();
    expect(el().querySelector('[role="timer"]')?.textContent).toContain('15:00');
    await vi.advanceTimersByTimeAsync(5000);
    f.detectChanges();
    expect(el().querySelector('[role="timer"]')?.textContent).toContain('14:55');

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    http.match(URL_RESERVA).forEach((r) => r.flush(reserva())); // el sondeo sigue devolviendo PENDIENTE hasta que corra el job
    await asentar();
    expect(el().querySelector('[role="timer"]')).toBeNull();
    expect(texto()).toContain('El tiempo para pagar terminó');
    expect(texto()).toContain('Escoger números de nuevo');
  });

  it('sondea cada 15 s y pasa a "Pago confirmado" cuando el organizador confirma', async () => {
    await montar();
    await vi.advanceTimersByTimeAsync(INTERVALO_RESERVA_MS);
    http.expectOne(URL_RESERVA).flush(reserva({ estado: 'CONFIRMADA', expiraEn: undefined }));
    await asentar();
    expect(texto()).toContain('Pago confirmado');
    expect(texto()).toContain('El organizador confirmó tu pago');
    expect(el().querySelector('[role="timer"]')).toBeNull();
    expect(texto()).not.toContain('Cómo pagar');
    // Ya no está pendiente: no debe haber más sondeos.
    await vi.advanceTimersByTimeAsync(INTERVALO_RESERVA_MS * 3);
    http.expectNone(URL_RESERVA);
  });

  it('el sondeo es de 15 s exactos: ni antes ni mucho después', async () => {
    await montar();
    await vi.advanceTimersByTimeAsync(14_000);
    http.expectNone(URL_RESERVA);
    await vi.advanceTimersByTimeAsync(1_500);
    http.expectOne(URL_RESERVA).flush(reserva());
    await asentar();
  });

  it('instrucciones de pago con el total exacto; sin WhatsApp configurado no hay botón', async () => {
    await montar();
    expect(texto()).toContain('Cómo pagar');
    expect(texto()).toMatch(/Paga\s*\$\s*20\.000/);
    expect(el().querySelector('a[href^="https://wa.me"]')).toBeNull();
    expect(texto()).toContain('te contactará al celular +57 300 ••• 4567');
  });

  it('con WhatsApp configurado, el botón lleva un mensaje con nombre, números, total y código', async () => {
    CONFIG_PAGO.whatsapp = '573009998877';
    await montar();
    const href = el().querySelector<HTMLAnchorElement>('a[href^="https://wa.me"]')?.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/573009998877?text=')).toBe(true);
    const mensaje = decodeURIComponent(href.split('text=')[1]);
    expect(mensaje).toContain('Ana Gómez');
    expect(mensaje).toContain('007, 042');
    expect(mensaje).toContain('Moto 0 km');
    expect(mensaje).toContain('ABC123');
    expect(mensaje).toMatch(/\$\s*20\.000/);
    expect(el().querySelector('a[href^="https://wa.me"]')?.getAttribute('rel')).toContain('noopener');
  });

  it('estados finales: vencida y liberada ofrecen volver a elegir y no muestran cómo pagar', async () => {
    await montar('3001234567', reserva({ estado: 'EXPIRADA' }));
    expect(texto()).toContain('Reserva vencida');
    expect(texto()).not.toContain('Cómo pagar');
    expect(el().querySelector('a.boton')?.getAttribute('href')).toBe('/rifa/R-001#numeros');
  });

  it('sin teléfono guardado lo pide, valida y luego muestra la reserva (y lo recuerda)', async () => {
    await montar(null);
    expect(texto()).toContain('Escribe el celular con el que reservaste');
    http.expectNone(URL_RESERVA);

    const campo = el().querySelector<HTMLInputElement>('#telefono')!;
    campo.value = '123';
    campo.dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    expect(texto()).toContain('celular colombiano válido');
    http.expectNone(URL_RESERVA);

    campo.value = '300 123 4567';
    campo.dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(URL_RESERVA).flush(reserva());
    await asentar();
    http.expectOne('/api/rifas/R-001').flush(detalle());
    await asentar();
    expect(texto()).toContain('Pendiente de pago');
    expect(el().querySelector('form')).toBeNull();
    expect(telefonoGuardado('ABC123')).toBe('3001234567');
  });

  it('404 (código y teléfono no coinciden): vuelve a pedir el teléfono y no lo recuerda', async () => {
    await montar('3009999999', null);
    http.expectOne(URL_RESERVA).flush({ estado: 404, mensaje: 'x' }, { status: 404, statusText: 'Not Found' });
    await asentar();
    expect(texto()).toContain('No encontramos una reserva con ese código y ese celular');
    expect(el().querySelector('#telefono')).toBeTruthy();
    expect(el().querySelector('[role="timer"]')).toBeNull();
  });

  it('si falla la consulta de la rifa, la reserva se muestra igual (sin ceros ni título)', async () => {
    localStorage.clear();
    guardarTelefono('ABC123', '3001234567');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Reserva);
    f.componentRef.setInput('codigo', 'ABC123');
    f.detectChanges();
    TestBed.tick();
    http.expectOne(URL_RESERVA).flush(reserva());
    await asentar();
    http.expectOne('/api/rifas/R-001').flush({ estado: 500, mensaje: 'x' }, { status: 500, statusText: 'Error' });
    await asentar();
    expect(texto()).toContain('Pendiente de pago');
    expect(texto()).toContain('Tu rifa');
    expect(texto()).toContain('7');
  });
});
