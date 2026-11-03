import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] }));

  it('pinta cabecera, contenido principal y pie', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-cabecera nav a[href="/mis-boletos"]')).toBeTruthy();
    expect(el.querySelector('main#contenido')).toBeTruthy();
    expect(el.querySelector('app-pie')?.textContent).toContain('demostración');
  });

  it('declara todas las rutas públicas del plan', () => {
    const paths = routes.map((r) => r.path);
    for (const p of ['admin', 'admin/login', '', 'rifa/:codigo', 'rifa/:codigo/reservar', 'reserva/:codigo', 'mis-boletos', 'resultados/:codigo']) {
      expect(paths).toContain(p);
    }
  });
});
