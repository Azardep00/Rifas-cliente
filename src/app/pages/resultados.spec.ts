import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { detalle } from './pruebas';
import { Resultados, textoReglaVacante } from './resultados';

const ganador = (o: Record<string, unknown> = {}) => ({
  codigoRifa: 'R-001', tituloRifa: 'Moto 0 km', posicionPremio: 1, premio: 'Moto', numeroBoleto: 7, publicado: true,
  creadoEn: '2026-11-15T15:00:00Z', ...o,
});

describe('Resultados (ganadores)', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<Resultados>;
  const el = () => f.nativeElement as HTMLElement;
  const texto = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const asentar = async () => { await f.whenStable(); f.detectChanges(); };

  function montar() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Resultados);
    f.componentRef.setInput('codigo', 'R-001');
    f.detectChanges();
    TestBed.tick();
  }
  const rifa = async (o: Record<string, unknown> = {}) => {
    http.expectOne('/api/rifas/R-001').flush(detalle(o));
    await asentar();
  };

  afterEach(() => http.verify());

  it('rifa sorteada: muestra premio y número con ceros, ordenados por premio', async () => {
    montar();
    await rifa({ estado: 'SORTEADA', digitos: 3 });
    http.expectOne('/api/rifas/R-001/ganadores').flush([
      ganador({ posicionPremio: 2, premio: 'Casco', numeroBoleto: 42 }),
      ganador({ posicionPremio: 1, premio: 'Moto', numeroBoleto: 7 }),
    ]);
    await asentar();
    const filas = [...el().querySelectorAll('ol.ganadores li')].map((li) =>
      ['.puesto', '.premio', '.numero'].map((c) => li.querySelector(c)?.textContent?.trim()).join(' | '));
    expect(filas).toEqual(['Premio 1 | Moto | 007', 'Premio 2 | Casco | 042']);
    expect(el().querySelector('[aria-label="Número ganador 007"]')).not.toBeNull();
    expect(texto()).toContain('Consulta tu reserva');
  });

  it('no muestra ganadores sin publicar', async () => {
    montar();
    await rifa({ estado: 'SORTEADA' });
    http.expectOne('/api/rifas/R-001/ganadores').flush([
      ganador({ posicionPremio: 1, numeroBoleto: 7, publicado: false }),
      ganador({ posicionPremio: 2, premio: 'Casco', numeroBoleto: 42, publicado: true }),
    ]);
    await asentar();
    expect(el().querySelectorAll('ol.ganadores li')).toHaveLength(1);
    expect([...el().querySelectorAll('ol.ganadores .premio')].map((e) => e.textContent?.trim())).toEqual(['Casco']);
  });

  it('sorteada pero ninguno publicado: avisa que aún no se publican', async () => {
    montar();
    await rifa({ estado: 'SORTEADA' });
    http.expectOne('/api/rifas/R-001/ganadores').flush([ganador({ publicado: false })]);
    await asentar();
    expect(texto()).toContain('aún no publica los ganadores');
    expect(el().querySelector('ol.ganadores')).toBeNull();
  });

  it('ganadores responde 404 (aún no publicado): no es un error de la pantalla', async () => {
    montar();
    await rifa({ estado: 'SORTEADA' });
    http.expectOne('/api/rifas/R-001/ganadores').flush({ mensaje: 'El sorteo de esta rifa aún no está publicado.' }, { status: 404, statusText: 'Not Found' });
    await asentar();
    expect(texto()).toContain('aún no publica los ganadores');
    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('rifa publicada o cerrada: sin resultados todavía, con la fecha del sorteo y SIN pedir ganadores', async () => {
    montar();
    await rifa({ estado: 'CERRADA' });
    expect(texto()).toContain('Todavía no hay resultados');
    expect(texto()).toContain('programado para el');
    http.expectNone('/api/rifas/R-001/ganadores');
  });

  it('rifa cancelada: lo dice y no pide ganadores', async () => {
    montar();
    await rifa({ estado: 'CANCELADA' });
    expect(texto()).toContain('fue cancelada');
    http.expectNone('/api/rifas/R-001/ganadores');
  });

  it('por lotería: nombra la lotería, las cifras y la regla de cupo vacío (ADR-07)', async () => {
    montar();
    await rifa({ estado: 'CERRADA', metodoSorteo: 'LOTERIA', loteriaNombre: 'Lotería de Bogotá', digitos: 3, reglaVacante: 'ADJUDICAR_SIGUIENTE_VENDIDO' });
    expect(texto()).toContain('Lotería de Bogotá');
    expect(texto()).toContain('las últimas 3 cifras');
    expect(texto()).toContain('el premio pasa al siguiente número vendido');
  });

  it('sorteo aleatorio: explica el método y no menciona loterías', async () => {
    montar();
    await rifa({ estado: 'CERRADA', metodoSorteo: 'ALEATORIO', loteriaNombre: undefined, digitos: undefined, reglaVacante: undefined });
    expect(texto()).toContain('se elige al azar entre los números vendidos');
    expect(texto()).not.toContain('lotería');
  });

  it('rifa inexistente: mensaje claro y sin reintentar', async () => {
    montar();
    http.expectOne('/api/rifas/R-001').flush({}, { status: 404, statusText: 'Not Found' });
    await asentar();
    expect(texto()).toContain('Esta rifa no existe o ya no está disponible');
    expect(el().querySelector('button')).toBeNull();
  });

  it('error en ganadores distinto de 404: muestra el error con Reintentar', async () => {
    montar();
    await rifa({ estado: 'SORTEADA' });
    http.expectOne('/api/rifas/R-001/ganadores').flush({ mensaje: 'Error interno.' }, { status: 500, statusText: 'Server Error' });
    await asentar();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Error interno.');
    expect(el().querySelector('button')?.textContent).toContain('Reintentar');
  });
});

describe('textoReglaVacante', () => {
  it('dice qué pasa en cada regla y nada si no hay regla', () => {
    expect(textoReglaVacante('REPETIR_SIGUIENTE_LOTERIA')).toContain('siguiente lotería');
    expect(textoReglaVacante('ADJUDICAR_SIGUIENTE_VENDIDO')).toContain('siguiente número vendido');
    expect(textoReglaVacante(undefined)).toBe('');
  });
});
