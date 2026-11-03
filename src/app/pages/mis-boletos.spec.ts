import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { guardarTelefono, telefonoGuardado } from '../core/reservas-locales';
import { MisBoletos } from './mis-boletos';

@Component({ template: '' })
class Vacio {}

const CODIGO = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';

describe('MisBoletos (consulta por código + celular)', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<MisBoletos>;
  let router: Router;
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
  const URL_CONSULTA = (r: { url: string }) => r.url.startsWith('/api/publico/reservas/');

  function montar(guardadas: Record<string, string> = {}) {
    localStorage.clear();
    for (const [c, t] of Object.entries(guardadas)) guardarTelefono(c, t);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'reserva/:codigo', component: Vacio }, { path: '**', component: Vacio }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    f = TestBed.createComponent(MisBoletos);
    f.detectChanges();
  }

  afterEach(() => http.verify());

  it('valida el código y el celular antes de llamar a la API', () => {
    montar();
    enviar();
    expect(texto()).toContain('Escribe el código de tu reserva');
    expect(texto()).toContain('celular colombiano válido');
    expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
    escribir('codigo', 'AB 12');
    escribir('telefono', '3001234567');
    enviar();
    expect(texto()).toContain('Escribe el código de tu reserva');
    escribir('codigo', CODIGO);
    escribir('telefono', '2001234567'); // no empieza por 3
    enviar();
    expect(texto()).not.toContain('Escribe el código de tu reserva');
    expect(texto()).toContain('celular colombiano válido');
    // http.verify() (afterEach) confirma que no salió ninguna petición.
  });

  it('el código necesita al menos 6 caracteres: 5 se rechaza sin llamar a la API, 6 se consulta', () => {
    montar();
    escribir('telefono', '3001234567');
    escribir('codigo', 'AB123');
    enviar();
    expect(texto()).toContain('Escribe el código de tu reserva');
    escribir('codigo', 'AB1234');
    enviar();
    expect(texto()).not.toContain('Escribe el código de tu reserva');
    http.expectOne(URL_CONSULTA).flush({}, { status: 404, statusText: 'Not Found' });
  });

  it('consulta con código y celular normalizado, recuerda el celular y abre la reserva', () => {
    montar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    escribir('codigo', `  ${CODIGO.toLowerCase()}  `);
    escribir('telefono', '+57 300 123 4567');
    enviar();
    const req = http.expectOne(URL_CONSULTA);
    expect(req.request.url).toBe(`/api/publico/reservas/${CODIGO.toLowerCase()}`);
    expect(req.request.params.get('telefono')).toBe('3001234567');
    req.flush({ codigo: CODIGO, codigoRifa: 'R-001', estado: 'PENDIENTE', numeros: [7], subtotal: 10000, moneda: 'COP', compradorNombre: 'Ana', telefonoEnmascarado: '300***4567', creadaEn: '2026-11-02T10:00:00Z' });
    expect(telefonoGuardado(CODIGO)).toBe('3001234567'); // con el código que devuelve la API
    expect(navegar).toHaveBeenCalledWith(['/reserva', CODIGO]);
  });

  it('404: muestra el mensaje de la API, no recuerda nada y permite reintentar', () => {
    montar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    escribir('codigo', CODIGO);
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne(URL_CONSULTA).flush({ mensaje: 'No encontramos una reserva con ese código y teléfono.' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('No encontramos una reserva con ese código y teléfono.');
    expect(telefonoGuardado(CODIGO)).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
    expect(el().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
    enviar();
    http.expectOne(URL_CONSULTA).flush({}, { status: 404, statusText: 'Not Found' });
  });

  it('429 (demasiadas consultas): muestra el mensaje de la API', () => {
    montar();
    escribir('codigo', CODIGO);
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne(URL_CONSULTA).flush({ mensaje: 'Demasiados intentos. Espera un momento.' }, { status: 429, statusText: 'Too Many Requests' });
    f.detectChanges();
    expect(texto()).toContain('Demasiados intentos. Espera un momento.');
  });

  it('mientras consulta, el botón está desactivado y un segundo envío no repite la petición', () => {
    montar();
    escribir('codigo', CODIGO);
    escribir('telefono', '3001234567');
    enviar();
    enviar();
    expect(el().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
    expect(http.match(URL_CONSULTA)).toHaveLength(1);
  });

  it('sin conexión: mensaje de servidor despertando', () => {
    montar();
    escribir('codigo', CODIGO);
    escribir('telefono', '3001234567');
    enviar();
    http.expectOne(URL_CONSULTA).error(new ProgressEvent('error'));
    f.detectChanges();
    expect(texto()).toContain('Puede estar despertando');
  });

  it('lista las reservas de este dispositivo (sin mostrar el celular) con enlace a cada una', () => {
    montar({ AAA111: '3001234567', BBB222: '3011234567' });
    const enlaces = [...el().querySelectorAll('ul.guardadas a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/reserva/BBB222', '/reserva/AAA111']); // la más reciente primero
    expect(texto()).not.toContain('3001234567');
    expect(texto()).not.toContain('3011234567');
  });

  it('Quitar borra la reserva de este dispositivo y de la lista, sin llamar a la API', () => {
    montar({ AAA111: '3001234567', BBB222: '3011234567' });
    el().querySelector<HTMLButtonElement>('button[aria-label="Quitar la reserva AAA111 de este dispositivo"]')!.click();
    f.detectChanges();
    expect(telefonoGuardado('AAA111')).toBeNull();
    expect(telefonoGuardado('BBB222')).toBe('3011234567');
    expect(el().querySelectorAll('ul.guardadas li')).toHaveLength(1);
  });

  it('sin reservas guardadas invita a ver las rifas', () => {
    montar();
    expect(texto()).toContain('Aún no has reservado desde este dispositivo');
    expect(el().querySelector('ul.guardadas')).toBeNull();
  });
});
