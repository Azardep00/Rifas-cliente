import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { respuesta } from './pruebas-auth';
import { Sesion, SinPermisoPanel } from './sesion';

describe('Sesion', () => {
  let http: HttpTestingController;
  const crear = () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(Sesion);
  };
  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());

  it('entra con ADMIN, guarda tokens y los recuerda tras recargar', () => {
    const s = crear();
    s.entrar(' a@x.co ', 'clave-larga-123').subscribe();
    const r = http.expectOne('/api/auth/login');
    expect(r.request.body).toEqual({ correo: 'a@x.co', contrasena: 'clave-larga-123' });
    r.flush(respuesta('ADMIN'));
    expect(s.esDelPanel()).toBe(true);
    expect(s.accessToken()).toBe('acc1');
    TestBed.resetTestingModule();
    const s2 = crear();
    expect(s2.autenticado()).toBe(true);
    expect(s2.rol()).toBe('ADMIN');
  });

  it('un CLIENTE no entra: se revoca lo recién abierto y falla con SinPermisoPanel', () => {
    const s = crear();
    let err: unknown;
    s.entrar('c@x.co', 'clave-larga-123').subscribe({ error: (e) => (err = e) });
    http.expectOne('/api/auth/login').flush(respuesta('CLIENTE'));
    expect(err).toBeInstanceOf(SinPermisoPanel);
    expect(s.autenticado()).toBe(false);
    expect(localStorage.getItem('alex-rifas:sesion')).toBeNull();
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
  });

  it('varios refrescos simultáneos comparten una sola petición y rotan el token', () => {
    const s = crear();
    s.entrar('a@x.co', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta('ORGANIZADOR', 1));
    const tokens: string[] = [];
    s.refrescar().subscribe((t) => tokens.push(t));
    s.refrescar().subscribe((t) => tokens.push(t));
    const r = http.expectOne('/api/auth/refresh');
    expect(r.request.body).toEqual({ refreshToken: 'ref1' });
    r.flush(respuesta('ORGANIZADOR', 2));
    expect(tokens).toEqual(['acc2', 'acc2']);
    expect(s.accessToken()).toBe('acc2');
  });

  it('si el refresh falla, la sesión se borra', () => {
    const s = crear();
    s.entrar('a@x.co', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta('ADMIN'));
    s.refrescar().subscribe({ error: () => undefined });
    http.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(s.autenticado()).toBe(false);
  });

  it('salir limpia aunque la API falle', () => {
    const s = crear();
    s.entrar('a@x.co', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta('ADMIN'));
    s.salir().subscribe();
    expect(s.autenticado()).toBe(false);
    http.expectOne('/api/auth/logout').flush({}, { status: 500, statusText: 'Error' });
  });

  it('ignora almacenamiento corrupto', () => {
    localStorage.setItem('alex-rifas:sesion', '{no es json');
    expect(crear().autenticado()).toBe(false);
  });
});
