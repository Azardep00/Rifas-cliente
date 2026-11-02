import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Inicio } from './inicio';
import { proveedoresPrueba, resumen } from './pruebas';

describe('Inicio', () => {
  let http: HttpTestingController;
  const montar = () => {
    TestBed.configureTestingModule({ imports: [Inicio], providers: proveedoresPrueba() });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    return fixture;
  };
  const pagina = (contenido: ReturnType<typeof resumen>[], p = 0, total = 1) =>
    ({ contenido, pagina: p, tamano: 12, totalElementos: contenido.length, totalPaginas: total });

  afterEach(() => http.verify());

  it('lista las rifas con precio, fecha, enlace al detalle y avance', async () => {
    const f = montar();
    http.expectOne((r) => r.url === '/api/rifas').flush(pagina([resumen()]));
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h2 a')?.getAttribute('href')).toBe('/rifa/R-001');
    expect(el.textContent).toContain('10.000');
    expect(el.textContent).toContain('Quedan 75 de 100');
    expect(el.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('25');
    expect(el.textContent).not.toContain('Ver más rifas');
  });

  it('muestra un mensaje cuando no hay rifas', async () => {
    const f = montar();
    http.expectOne((r) => r.url === '/api/rifas').flush(pagina([], 0, 0));
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Todavía no hay rifas abiertas');
  });

  it('ofrece "Ver más" y agrega la página siguiente sin perder la anterior', async () => {
    const f = montar();
    http.expectOne((r) => r.url === '/api/rifas').flush(pagina([resumen()], 0, 2));
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Ver más')) as HTMLButtonElement).click();
    const req = http.expectOne((r) => r.url === '/api/rifas');
    expect(req.request.params.get('pagina')).toBe('1');
    req.flush(pagina([resumen({ codigo: 'R-002', titulo: 'Nevera' })], 1, 2));
    await f.whenStable();
    expect(el.querySelectorAll('article').length).toBe(2);
    expect(el.textContent).not.toContain('Ver más rifas');
  });

  it('si el servidor no responde muestra el error y reintenta', async () => {
    const f = montar();
    http.expectOne((r) => r.url === '/api/rifas').error(new ProgressEvent('error'));
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')?.textContent).toContain('No pudimos conectar');
    (el.querySelector('button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === '/api/rifas').flush(pagina([resumen()]));
    await f.whenStable();
    expect(el.querySelectorAll('article').length).toBe(1);
  });
});
