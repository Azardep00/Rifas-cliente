import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { GrillaBoletos, RifaDetalle } from '../core/api/models';
import { Carrito } from '../core/carrito';
import { GrillaRifa, INTERVALO_GRILLA_MS } from './grilla-rifa';

const RIFA: RifaDetalle = {
  codigo: 'R1', titulo: 'Moto', estado: 'PUBLICADA', precioBoleto: 10000, moneda: 'COP', cantidadBoletos: 100,
  fechaSorteo: '2026-12-01T00:00:00Z', cierreVentasEn: '2026-11-30T00:00:00Z', maximoBoletosPorCompra: 3,
  metodoSorteo: 'LOTERIA', organizador: 'Alex', disponibilidad: { disponibles: 100, reservados: 0, vendidos: 0 },
  premios: [], digitos: 2, reservaMinutos: 60,
};

function grilla(estados: string): GrillaBoletos {
  const cuenta = (c: string) => [...estados].filter((x) => x === c).length;
  return { codigoRifa: 'R1', cantidad: estados.length, digitos: 2, estados, libres: cuenta('L'), reservados: cuenta('R'), vendidos: cuenta('V'), generadaEn: '2026-11-02T00:00:00Z' };
}
const LIBRES = 'L'.repeat(100);

@Component({ imports: [GrillaRifa], template: `<app-grilla-rifa [rifa]="rifa()" />` })
class Anfitrion {
  rifa = signal(RIFA);
}

/** Con temporizadores simulados whenStable no avanza: se corre la cola y se repinta a mano. */
async function asentar(fixture: { detectChanges(): void }) {
  await vi.advanceTimersByTimeAsync(0);
  fixture.detectChanges();
}

describe('GrillaRifa', () => {
  let http: HttpTestingController;

  async function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    // No se espera a whenStable: HttpClient registra la petición como tarea pendiente hasta que se responda.
    fixture.detectChanges();
    TestBed.tick(); // vacía los effects (toObservable) para que arranque la consulta
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }
  const pendientes = () => http.match((r) => r.url === '/api/rifas/R1/boletos');
  const texto = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pide la grilla, la pinta y muestra la leyenda con conteos', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    const [req] = pendientes();
    req.flush(grilla('LRV' + 'L'.repeat(97)));
    await asentar(fixture);
    expect(el.querySelectorAll('button[data-n]')).toHaveLength(100);
    expect(texto(el)).toContain('Libre 98');
    expect(texto(el)).toContain('Reservado 1');
    expect(texto(el)).toContain('Vendido 1');
  });

  it('refresca cada 10 s', async () => {
    const { fixture } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    expect(pendientes()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS);
    const segunda = pendientes();
    expect(segunda).toHaveLength(1);
    segunda[0].flush(grilla(LIBRES));
  });

  it('no apila peticiones si el servidor tarda: la que va en curso termina', async () => {
    await montar();
    await vi.advanceTimersByTimeAsync(0);
    const primera = pendientes();
    expect(primera).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS * 3);
    expect(pendientes()).toHaveLength(0); // ninguna nueva, la primera sigue abierta
    primera[0].flush(grilla(LIBRES));
  });

  it('no consulta mientras la pestaña está oculta y consulta al volver', async () => {
    const { fixture } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);

    let oculta = true;
    const espia = vi.spyOn(document, 'hidden', 'get').mockImplementation(() => oculta);
    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS * 2);
    expect(pendientes()).toHaveLength(0);

    oculta = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    const volvio = pendientes();
    expect(volvio).toHaveLength(1);
    volvio[0].flush(grilla(LIBRES));
    espia.mockRestore();
  });

  it('elegir números alimenta el carrito y respeta el máximo con un aviso', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    const carrito = TestBed.inject(Carrito);
    const n = (i: number) => el.querySelector<HTMLButtonElement>(`button[data-n="${i}"]`)!;

    [7, 42, 8].forEach((i) => n(i).click());
    await asentar(fixture);
    expect(carrito.numeros()).toEqual([7, 8, 42]);
    expect(n(7).getAttribute('aria-pressed')).toBe('true');
    expect(texto(el)).toContain('3 números');
    expect(el.querySelector('aside')?.textContent).toContain('$');

    n(50).click();
    await asentar(fixture);
    expect(carrito.numeros()).toEqual([7, 8, 42]);
    expect(el.querySelector('[role="status"]:not([hidden])')?.textContent).toContain('Máximo 3 números por reserva');

    n(7).click(); // quitar libera cupo y borra el aviso
    await asentar(fixture);
    expect(carrito.numeros()).toEqual([8, 42]);
    expect(el.querySelector('p.aviso--vivo')?.hasAttribute('hidden')).toBe(true);
  });

  it('si otra persona toma un número elegido, sale de la selección y se avisa', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    const carrito = TestBed.inject(Carrito);
    el.querySelector<HTMLButtonElement>('button[data-n="7"]')!.click();
    el.querySelector<HTMLButtonElement>('button[data-n="8"]')!.click();
    await asentar(fixture);

    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS);
    pendientes()[0].flush(grilla('L'.repeat(7) + 'R' + 'L'.repeat(92)));
    await asentar(fixture);

    expect(carrito.numeros()).toEqual([8]);
    expect(texto(el)).toContain('El número 07 ya no está disponible y salió de tu selección.');
  });

  it('el botón Reservar lleva al checkout de la rifa', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    el.querySelector<HTMLButtonElement>('button[data-n="3"]')!.click();
    await asentar(fixture);
    expect(el.querySelector('aside a.boton')?.getAttribute('href')).toBe('/rifa/R1/reservar');
  });

  it('muestra el error con "Reintentar" cuando nunca cargó, y reintenta', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].error(new ProgressEvent('error'), { status: 0 });
    await asentar(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No pudimos conectar con el servidor');

    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('button[data-n]')).toHaveLength(100);
  });

  it('si falla un refresco conserva la última grilla y lo dice', async () => {
    const { fixture, el } = await montar();
    await vi.advanceTimersByTimeAsync(0);
    pendientes()[0].flush(grilla(LIBRES));
    await asentar(fixture);
    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS);
    pendientes()[0].error(new ProgressEvent('error'), { status: 0 });
    await asentar(fixture);
    expect(el.querySelectorAll('button[data-n]')).toHaveLength(100);
    expect(texto(el)).toContain('ves lo último que supimos');
  });

  it('una rifa CERRADA se ve en solo lectura, vacía el carrito y consulta una sola vez', async () => {
    const carrito = TestBed.inject(Carrito);
    carrito.configurar({ codigo: 'R1', precio: 10000, moneda: 'COP', maximo: 3, digitos: 2 });
    carrito.alternar(5);
    const { fixture, host, el } = await montar();
    host.rifa.set({ ...RIFA, estado: 'CERRADA' });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    const reqs = pendientes();
    reqs[reqs.length - 1].flush(grilla(LIBRES));
    await asentar(fixture);

    expect(texto(el)).toContain('Las ventas están cerradas');
    expect(carrito.numeros()).toEqual([]);
    el.querySelector<HTMLButtonElement>('button[data-n="3"]')!.click();
    expect(carrito.numeros()).toEqual([]);
    await vi.advanceTimersByTimeAsync(INTERVALO_GRILLA_MS * 3);
    expect(pendientes()).toHaveLength(0);
  });
});
