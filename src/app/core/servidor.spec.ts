import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESPERA_REINTENTO_MS,
  Servidor,
  UMBRAL_LENTA_MS,
  debeReintentar,
  esFalloDeArranque,
  servidorInterceptor,
} from './servidor';

describe('esFalloDeArranque / debeReintentar', () => {
  it('reconoce los estados de un servidor dormido', () => {
    for (const s of [0, 502, 503, 504]) expect(esFalloDeArranque(s)).toBe(true);
    for (const s of [200, 400, 401, 404, 409, 429, 500]) expect(esFalloDeArranque(s)).toBe(false);
  });

  it('no reintenta sin red ni errores de negocio', () => {
    const e502 = new HttpErrorResponse({ status: 502 });
    expect(debeReintentar(e502, true)).toBe(true);
    expect(debeReintentar(e502, false)).toBe(false);
    expect(debeReintentar(new HttpErrorResponse({ status: 409 }), true)).toBe(false);
    expect(debeReintentar(new Error('x'), true)).toBe(false);
  });
});

describe('Servidor + servidorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let servidor: Servidor;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([servidorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    servidor = TestBed.inject(Servidor);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('una respuesta rápida nunca muestra el aviso', () => {
    http.get('/api/rifas').subscribe();
    ctrl.expectOne('/api/rifas').flush([]);
    vi.advanceTimersByTime(UMBRAL_LENTA_MS * 2);
    expect(servidor.despertando()).toBe(false);
  });

  it('una petición lenta enciende el aviso y al responder se apaga', () => {
    http.get('/api/rifas').subscribe();
    const req = ctrl.expectOne('/api/rifas');
    vi.advanceTimersByTime(UMBRAL_LENTA_MS + 100);
    expect(servidor.despertando()).toBe(true);
    req.flush([]);
    expect(servidor.despertando()).toBe(false);
  });

  it('un GET con 502 muestra el aviso y se reintenta solo', () => {
    let resultado: unknown;
    http.get('/api/rifas').subscribe((r) => (resultado = r));
    ctrl.expectOne('/api/rifas').flush('', { status: 502, statusText: 'Bad Gateway' });
    expect(servidor.despertando()).toBe(true);
    vi.advanceTimersByTime(ESPERA_REINTENTO_MS + 10);
    ctrl.expectOne('/api/rifas').flush({ ok: true });
    expect(resultado).toEqual({ ok: true });
    expect(servidor.despertando()).toBe(false);
  });

  it('un POST con 502 NO se reintenta', () => {
    let fallo: unknown;
    http.post('/api/publico/reservas', {}).subscribe({ error: (e) => (fallo = e) });
    ctrl.expectOne('/api/publico/reservas').flush('', { status: 502, statusText: 'Bad Gateway' });
    vi.advanceTimersByTime(ESPERA_REINTENTO_MS * 3);
    ctrl.expectNone('/api/publico/reservas');
    expect(fallo).toBeInstanceOf(HttpErrorResponse);
    expect(servidor.despertando()).toBe(false);
  });

  it('un error de negocio (409) no se reintenta ni muestra el aviso', () => {
    let fallo: unknown;
    http.get('/api/rifas/ABC').subscribe({ error: (e) => (fallo = e) });
    ctrl.expectOne('/api/rifas/ABC').flush({}, { status: 409, statusText: 'Conflict' });
    expect(fallo).toBeInstanceOf(HttpErrorResponse);
    expect(servidor.despertando()).toBe(false);
  });

  it('ignora lo que no es /api', () => {
    http.get('/assets/x.json').subscribe();
    ctrl.expectOne('/assets/x.json');
    vi.advanceTimersByTime(UMBRAL_LENTA_MS * 2);
    expect(servidor.despertando()).toBe(false);
  });
});
