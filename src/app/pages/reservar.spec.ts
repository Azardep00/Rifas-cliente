import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { Carrito } from '../core/carrito';
import { telefonoGuardado } from '../core/reservas-locales';
import { detalle } from './pruebas';
import { Reservar } from './reservar';

@Component({ template: '' })
class Vacio {}

describe('Reservar (checkout de invitado)', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<Reservar>;
  const el = () => f.nativeElement as HTMLElement;
  const texto = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const campo = (id: string) => el().querySelector<HTMLInputElement>(`#${id}`)!;
  const escribir = (id: string, valor: string) => {
    campo(id).value = valor;
    campo(id).dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  const enviar = () => {
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
  };

  async function montar(numeros: number[] = [7, 42], rifa = detalle()) {
    localStorage.clear();
    sessionStorage.clear();
    if (numeros.length) sessionStorage.setItem('alex-rifas:carrito', JSON.stringify({ codigo: 'R-001', numeros }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'reserva/:codigo', component: Vacio }, { path: '**', component: Vacio }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Reservar);
    f.componentRef.setInput('codigo', 'R-001');
    f.detectChanges();
    http.expectOne('/api/rifas/R-001').flush(rifa);
    await f.whenStable();
    f.detectChanges();
  }

  afterEach(() => http.verify());

  const RESERVA = {
    codigo: 'ABC123', codigoRifa: 'R-001', estado: 'PENDIENTE', numeros: [7, 42], subtotal: 20000, moneda: 'COP',
    compradorNombre: 'Ana Gómez', telefonoEnmascarado: '+57 300 ••• 4567', creadaEn: '2026-11-02T10:00:00Z',
  };

  it('muestra los números elegidos, el total y el plazo de pago', async () => {
    await montar();
    expect(texto()).toContain('07');
    expect(texto()).toContain('42');
    expect(texto()).toMatch(/Total a pagar\s*\$\s*20\.000/);
    expect(texto()).toContain('Reservamos tus números por 1 hora');
  });

  it('sin números elegidos manda a escogerlos', async () => {
    await montar([]);
    expect(texto()).toContain('Todavía no has escogido números');
    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelector('a.boton')?.getAttribute('href')).toBe('/rifa/R-001#numeros');
  });

  it('una rifa que no está publicada no recibe reservas', async () => {
    await montar([7], detalle({ estado: 'CERRADA' }));
    expect(texto()).toContain('ya no recibe reservas');
    expect(el().querySelector('form')).toBeNull();
  });

  it('quitar un número recalcula el total', async () => {
    await montar();
    el().querySelector<HTMLButtonElement>('button[aria-label="Quitar el número 07"]')!.click();
    f.detectChanges();
    expect(texto()).toMatch(/Total a pagar\s*\$\s*10\.000/);
  });

  it('valida nombre y celular antes de llamar a la API', async () => {
    await montar();
    enviar();
    expect(texto()).toContain('Escribe tu nombre');
    expect(texto()).toContain('celular colombiano válido');
    expect(campo('nombre').getAttribute('aria-invalid')).toBe('true');
    escribir('nombre', 'Ana');
    escribir('telefono', '2001234567');
    enviar();
    expect(texto()).not.toContain('Escribe tu nombre');
    expect(texto()).toContain('celular colombiano válido');
    // http.verify() (afterEach) confirma que no salió ninguna petición.
  });

  it('el nombre necesita al menos 2 letras (igual que la API)', async () => {
    await montar();
    escribir('telefono', '3001234567');
    escribir('nombre', 'A');
    enviar();
    expect(texto()).toContain('Escribe tu nombre (mínimo 2 letras)');
    escribir('nombre', '   B   ');
    enviar();
    expect(texto()).toContain('Escribe tu nombre (mínimo 2 letras)');
    // http.verify() (afterEach) confirma que no salió ninguna petición.
  });

  it('una rifa CERRADA con números guardados no muestra el formulario ni el botón de reservar', async () => {
    await montar([7, 42], detalle({ estado: 'CERRADA' }));
    expect(el().querySelector('form')).toBeNull();
    expect(texto()).not.toContain('Reservar 2 números');
    expect(texto()).not.toContain('Tus datos');
  });

  it('reserva: envía el celular normalizado, vacía el carrito, recuerda el teléfono y abre la reserva', async () => {
    await montar();
    escribir('nombre', '  Ana   Gómez ');
    escribir('telefono', '+57 300 123 4567');
    enviar();
    const req = http.expectOne('/api/publico/reservas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigoRifa: 'R-001', nombre: 'Ana Gómez', telefono: '3001234567', numeros: [7, 42] });
    req.flush(RESERVA, { status: 201, statusText: 'Created' });
    await f.whenStable();

    expect(TestBed.inject(Router).url).toBe('/reserva/ABC123');
    expect(TestBed.inject(Carrito).numeros()).toEqual([]);
    expect(telefonoGuardado('ABC123')).toBe('3001234567');
  });

  it('un doble clic no crea dos reservas', async () => {
    await montar();
    escribir('nombre', 'Ana Gómez');
    escribir('telefono', '3001234567');
    enviar();
    enviar();
    const req = http.expectOne('/api/publico/reservas'); // expectOne falla si hay más de una
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    req.flush(RESERVA, { status: 201, statusText: 'Created' });
    await f.whenStable();
  });

  it('409 (número ocupado): muestra el mensaje de la API, conserva la selección y permite reintentar', async () => {
    await montar();
    escribir('nombre', 'Ana Gómez');
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne('/api/publico/reservas').flush(
      { estado: 409, mensaje: 'El número 42 ya no está disponible.' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    f.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('El número 42 ya no está disponible.');
    expect(texto()).toContain('Volver a elegir números');
    expect(TestBed.inject(Carrito).numeros()).toEqual([7, 42]);
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(telefonoGuardado('ABC123')).toBeNull();
  });

  it('429 (demasiadas reservas pendientes): muestra el mensaje de la API', async () => {
    await montar();
    escribir('nombre', 'Ana Gómez');
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne('/api/publico/reservas').flush(
      { estado: 429, mensaje: 'Ya tienes 3 reservas pendientes de pago.' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '720' } });
    await f.whenStable();
    f.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Ya tienes 3 reservas pendientes');
  });

  it('sin conexión: mensaje de servidor despertando y se puede reintentar', async () => {
    await montar();
    escribir('nombre', 'Ana Gómez');
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne('/api/publico/reservas').error(new ProgressEvent('error'), { status: 0 });
    await f.whenStable();
    f.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos conectar con el servidor');
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
});
