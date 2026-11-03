import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor, esRutaPrivada } from './auth.interceptor';
import { respuesta } from './pruebas-auth';
import { Sesion } from './sesion';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let sesion: Sesion;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    sesion = TestBed.inject(Sesion);
    sesion.entrar('a@x.co', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta('ADMIN', 1));
  });
  afterEach(() => http.verify());

  it('solo /api/admin y /api/organizador son privadas', () => {
    expect(esRutaPrivada('/api/admin/compras')).toBe(true);
    expect(esRutaPrivada('/api/organizador/rifas')).toBe(true);
    expect(esRutaPrivada('/api/rifas')).toBe(false);
    expect(esRutaPrivada('/api/auth/login')).toBe(false);
    expect(esRutaPrivada('/api/administrador')).toBe(false);
  });

  it('agrega Bearer a rutas privadas y no a las públicas', () => {
    cliente.get('/api/admin/x').subscribe();
    expect(http.expectOne('/api/admin/x').request.headers.get('Authorization')).toBe('Bearer acc1');
    cliente.get('/api/rifas').subscribe();
    expect(http.expectOne('/api/rifas').request.headers.has('Authorization')).toBe(false);
  });

  it('ante 401 refresca una vez y repite la petición con el token nuevo', () => {
    let ok: unknown;
    cliente.get('/api/admin/x').subscribe((v) => (ok = v));
    http.expectOne('/api/admin/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(respuesta('ADMIN', 2));
    const repetida = http.expectOne('/api/admin/x');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer acc2');
    repetida.flush({ ok: 1 });
    expect(ok).toEqual({ ok: 1 });
  });

  it('dos 401 simultáneos provocan un solo refresh', () => {
    cliente.get('/api/admin/a').subscribe();
    cliente.get('/api/admin/b').subscribe();
    http.expectOne('/api/admin/a').flush({}, { status: 401, statusText: 'U' });
    http.expectOne('/api/admin/b').flush({}, { status: 401, statusText: 'U' });
    http.expectOne('/api/auth/refresh').flush(respuesta('ADMIN', 2));
    http.expectOne('/api/admin/a').flush({});
    http.expectOne('/api/admin/b').flush({});
  });

  it('si el refresh falla, cierra sesión y manda al login', async () => {
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    cliente.get('/api/admin/x').subscribe({ error: () => undefined });
    http.expectOne('/api/admin/x').flush({}, { status: 401, statusText: 'U' });
    http.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'U' });
    expect(sesion.autenticado()).toBe(false);
    expect(nav).toHaveBeenCalledWith(['/admin/login'], { queryParams: { expirada: 1 } });
  });

  it('un 403 no intenta refrescar', () => {
    let status = 0;
    cliente.get('/api/admin/x').subscribe({ error: (e) => (status = e.status) });
    http.expectOne('/api/admin/x').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});
