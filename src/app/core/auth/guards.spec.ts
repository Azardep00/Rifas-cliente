import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { panelMatch, soloSinSesionGuard } from './guards';
import { Sesion } from './sesion';
import { respuesta } from './pruebas-auth';
import { Rol } from '../api/models';

describe('guards del panel', () => {
  const montar = (rol: Rol | null) => {
    localStorage.clear();
    if (rol) localStorage.setItem('alex-rifas:sesion', JSON.stringify(respuesta(rol)));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.inject(Router);
  };
  const correr = (g: typeof panelMatch) =>
    TestBed.runInInjectionContext(() => g({} as never, [new UrlSegment('admin', {}), new UrlSegment('pagos', {})], {} as never));

  it('ADMIN y ORGANIZADOR pasan', () => {
    montar('ADMIN');
    expect(correr(panelMatch)).toBe(true);
    TestBed.resetTestingModule();
    montar('ORGANIZADOR');
    expect(correr(panelMatch)).toBe(true);
  });

  it('un CLIENTE no entra a /admin: va al inicio', () => {
    const router = montar('CLIENTE');
    expect(router.serializeUrl(correr(panelMatch) as UrlTree)).toBe('/');
  });

  it('sin sesión va al login recordando el destino', () => {
    const router = montar(null);
    expect(router.serializeUrl(correr(panelMatch) as UrlTree)).toBe('/admin/login?volver=%2Fadmin%2Fpagos');
  });

  it('el login con sesión de panel redirige al panel; sin sesión deja pasar', () => {
    const router = montar('ADMIN');
    const r = TestBed.runInInjectionContext(() => soloSinSesionGuard({} as never, {} as never));
    expect(router.serializeUrl(r as UrlTree)).toBe('/admin');
    TestBed.resetTestingModule();
    montar(null);
    expect(TestBed.runInInjectionContext(() => soloSinSesionGuard({} as never, {} as never))).toBe(true);
  });
});
