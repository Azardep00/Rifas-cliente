import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError, errorInterceptor } from './api-error';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista rifas con paginación', () => {
    api.rifas(1, 6).subscribe();
    const req = http.expectOne((r) => r.url === '/api/rifas');
    expect(req.request.params.get('pagina')).toBe('1');
    expect(req.request.params.get('tamano')).toBe('6');
    req.flush({ contenido: [], pagina: 1, tamano: 6, totalElementos: 0, totalPaginas: 0 });
  });

  it('reserva como invitado con POST a /api/publico/reservas', () => {
    const cuerpo = { codigoRifa: 'R1', nombre: 'Ana', telefono: '3001234567', numeros: [7, 42] };
    api.reservar(cuerpo).subscribe();
    const req = http.expectOne('/api/publico/reservas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({});
  });

  it('consulta la reserva por código y teléfono (codificados)', () => {
    api.consultarReserva('AB 1', '+57 300').subscribe();
    const req = http.expectOne((r) => r.url === '/api/publico/reservas/AB%201');
    expect(req.request.params.get('telefono')).toBe('+57 300');
    req.flush({});
  });

  it('traduce el mensaje de la API y el Retry-After del 429', () => {
    let error: unknown;
    api.reservar({ codigoRifa: 'R1', nombre: 'Ana', telefono: '3001234567', numeros: [1] })
      .subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/publico/reservas').flush(
      { estado: 429, mensaje: 'Demasiadas reservas pendientes.' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '120' } },
    );
    expect(error).toBeInstanceOf(ApiError);
    const e = error as ApiError;
    expect(e.estado).toBe(429);
    expect(e.message).toBe('Demasiadas reservas pendientes.');
    expect(e.reintentarEn).toBe(120);
  });

  it('un fallo de red (servidor dormido) se marca como sin conexión', () => {
    let error: unknown;
    api.rifas().subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/rifas').error(new ProgressEvent('error'));
    expect((error as ApiError).sinConexion).toBe(true);
  });
});
