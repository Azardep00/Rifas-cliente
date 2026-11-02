import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Detalle } from './detalle';
import { detalle, proveedoresPrueba } from './pruebas';

describe('Detalle', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<Detalle>;
  const texto = () => (f.nativeElement as HTMLElement).textContent ?? '';

  const montar = async (respuesta: unknown,
                        opts?: { status: number; statusText: string }) => {
    TestBed.configureTestingModule({ imports: [Detalle], providers: proveedoresPrueba() });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(Detalle);
    f.componentRef.setInput('codigo', 'R-001');
    f.detectChanges();
    http.expectOne('/api/rifas/R-001').flush(respuesta as object, opts);
    await f.whenStable();
  };

  afterEach(() => http.verify());

  it('rifa por lotería: premios, dígitos y la regla de cupo vacío visibles', async () => {
    await montar(detalle());
    expect(texto()).toContain('Moto');
    expect(texto()).toContain('Casco');
    expect(texto()).toContain('últimas 2 cifras');
    expect(texto()).toContain('Lotería de Bogotá');
    expect(texto()).toContain('el premio espera al siguiente sorteo');
    expect(texto()).toContain('Tu reserva dura 1 hora');
  });

  it('regla ADJUDICAR_SIGUIENTE_VENDIDO se explica distinto', async () => {
    await montar(detalle({ reglaVacante: 'ADJUDICAR_SIGUIENTE_VENDIDO' }));
    expect(texto()).toContain('gana el siguiente número vendido');
  });

  it('rifa publicada: botón para escoger números hacia /reservar', async () => {
    await montar(detalle());
    const a = (f.nativeElement as HTMLElement).querySelector('a.boton');
    expect(a?.getAttribute('href')).toBe('/rifa/R-001/reservar');
  });

  it('rifa sorteada: lleva a resultados y no ofrece reservar', async () => {
    await montar(detalle({ estado: 'SORTEADA' }));
    const a = (f.nativeElement as HTMLElement).querySelector('a.boton');
    expect(a?.getAttribute('href')).toBe('/resultados/R-001');
    expect(texto()).not.toContain('Escoger números');
  });

  it('rifa cerrada: avisa que las ventas terminaron', async () => {
    await montar(detalle({ estado: 'CERRADA' }));
    expect(texto()).toContain('Las ventas están cerradas');
    expect(texto()).not.toContain('Escoger números');
  });

  it('rifa aleatoria no menciona lotería', async () => {
    await montar(detalle({ metodoSorteo: 'ALEATORIO', loteriaNombre: undefined, digitos: undefined, reglaVacante: undefined }));
    expect(texto()).toContain('al azar');
    expect(texto()).not.toContain('cifras');
  });

  it('404: mensaje claro y sin botón de reintentar', async () => {
    await montar({ estado: 404, mensaje: 'x' }, { status: 404, statusText: 'Not Found' });
    expect(texto()).toContain('no existe');
    expect((f.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
