import { Component, DestroyRef, effect, computed, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, distinctUntilChanged, exhaustMap, filter, fromEvent, map, merge, of, switchMap, tap, timer } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { GrillaBoletos, RifaDetalle } from '../core/api/models';
import { formatearNumero } from '../core/boletos';
import { Carrito } from '../core/carrito';
import { CarritoFlotante } from './carrito-flotante';
import { GrillaNumeros } from './grilla-numeros';

/** Cada cuánto se vuelve a pedir la grilla mientras la pestaña está visible (el plan pide ~10 s). */
export const INTERVALO_GRILLA_MS = 10_000;

/**
 * Sección "Escoge tus números" de la página de detalle: pide la grilla a la API, la refresca sola,
 * conecta la selección con el carrito y muestra la barra flotante.
 * Uso: `<app-grilla-rifa [rifa]="rifa" />` (con el `RifaDetalle` ya cargado).
 */
@Component({
  selector: 'app-grilla-rifa',
  imports: [GrillaNumeros, CarritoFlotante],
  template: `
    <section class="grilla-rifa" [class.con-barra]="carrito.cantidad() > 0" aria-labelledby="titulo-grilla">
      <h2 id="titulo-grilla">Escoge tus números</h2>

      @if (abierta()) {
        <p class="ayuda">
          Toca un número para elegirlo (hasta {{ rifa().maximoBoletosPorCompra }} por reserva). Un número reservado
          vuelve a quedar libre si no se paga en {{ rifa().reservaMinutos }} minutos.
        </p>
      } @else {
        <p class="aviso">{{ motivoCerrada() }}</p>
      }

      <!-- Región viva: anuncia a lectores de pantalla cuando un número sale de la selección. -->
      <p class="aviso aviso--vivo" role="status" [hidden]="!aviso()">{{ aviso() }}</p>

      @if (grilla(); as g) {
        <ul class="leyenda" aria-label="Leyenda">
          <li><span class="muestra libre"></span> Libre <b>{{ g.libres }}</b></li>
          <li><span class="muestra elegida"></span> Tu selección</li>
          <li><span class="muestra reservado"></span> Reservado <b>{{ g.reservados }}</b></li>
          <li><span class="muestra vendido"></span> Vendido <b>{{ g.vendidos }}</b></li>
        </ul>

        <app-grilla-numeros [estados]="g.estados" [digitos]="g.digitos ?? rifa().digitos" [seleccionados]="carrito.numeros()"
                            [soloLectura]="!abierta()" (alternar)="alternar($event)" />

        <p class="sync">
          Actualizado a las {{ hora() }} · se refresca solo cada {{ segundos }} s.
          @if (error()) {
            <span class="falla">No pudimos actualizar ahora; ves lo último que supimos.</span>
          }
        </p>
      } @else if (error(); as e) {
        <div class="falla-bloque" role="alert">
          <p>{{ e.message }}</p>
          <button type="button" class="boton boton--secundario" (click)="reintentar()">Reintentar</button>
        </div>
      } @else {
        <p class="cargando" role="status">Cargando los números…</p>
      }

      <app-carrito-flotante />
    </section>
  `,
  styles: `
    .grilla-rifa { padding-block: var(--e4); }
    /* Deja espacio para que la barra flotante no tape el final de la grilla. */
    .grilla-rifa.con-barra { padding-bottom: 9rem; }
    .ayuda { color: var(--tinta-suave); }
    .aviso { margin: 0 0 var(--e3); padding: var(--e2) var(--e3); border-left: 4px solid var(--ambar); background: var(--superficie); max-width: none; }
    .aviso[hidden] { display: none; }
    .leyenda { display: flex; flex-wrap: wrap; gap: var(--e2) var(--e4); margin: 0 0 var(--e3); padding: 0; list-style: none; font-size: var(--t-1); }
    .leyenda li { display: flex; align-items: center; gap: var(--e2); }
    .muestra { width: 1.25rem; height: 1.25rem; border-radius: 0.3rem; border: 1px solid var(--linea); background: var(--superficie); }
    .muestra.elegida { background: var(--sol); border: 2px solid var(--tinta); }
    .muestra.reservado { border: 2px dashed var(--ambar); }
    .muestra.vendido { background: repeating-linear-gradient(135deg, transparent 0 3px, var(--vendido) 3px 4px); }
    .sync { margin: var(--e3) 0 0; color: var(--tinta-suave); font-size: var(--t-1); }
    .falla { color: var(--error); }
    .falla-bloque { padding: var(--e4); border: 1px solid var(--error); border-radius: var(--radio); background: var(--superficie); }
    .cargando { color: var(--tinta-suave); }
  `,
})
export class GrillaRifa {
  readonly rifa = input.required<RifaDetalle>();

  protected readonly carrito = inject(Carrito);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly segundos = INTERVALO_GRILLA_MS / 1000;
  protected readonly grilla = signal<GrillaBoletos | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly aviso = signal('');
  private readonly actualizadaEn = signal<Date | null>(null);
  private readonly reintento = new Subject<void>();

  /** Solo una rifa PUBLICADA recibe reservas; el resto se muestra en solo lectura. */
  protected readonly abierta = computed(() => this.rifa().estado === 'PUBLICADA');
  protected readonly motivoCerrada = computed(() => {
    switch (this.rifa().estado) {
      case 'CERRADA': return 'Las ventas están cerradas. Falta jugar el sorteo.';
      case 'SORTEADA': return 'El sorteo ya se jugó. Mira los resultados para ver los ganadores.';
      default: return 'Esta rifa no está recibiendo reservas.';
    }
  });
  protected readonly hora = computed(() => {
    const d = this.actualizadaEn();
    return d ? new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' }).format(d) : '';
  });

  constructor() {
    // Mantiene el carrito alineado con la rifa mostrada (límite por reserva, precio, moneda).
    effect(() => {
      const r = this.rifa();
      untracked(() => {
        this.carrito.configurar({ codigo: r.codigo, precio: r.precioBoleto, moneda: r.moneda, maximo: r.maximoBoletosPorCompra, digitos: r.digitos });
        if (r.estado !== 'PUBLICADA') this.carrito.vaciar();
      });
    });

    // Una rifa distinta, o que cambia de PUBLICADA a otro estado, reinicia la consulta.
    toObservable(computed(() => ({ codigo: this.rifa().codigo, viva: this.abierta() }))).pipe(
      distinctUntilChanged((a, b) => a.codigo === b.codigo && a.viva === b.viva),
      tap(() => {
        this.grilla.set(null);
        this.error.set(null);
      }),
      switchMap(({ codigo, viva }) =>
        this.latidos(viva).pipe(
          // exhaustMap (no switchMap): si el servidor tarda ~1 min en despertar, la petición en curso
          // debe poder terminar en vez de cancelarse y repetirse cada 10 s para siempre.
          exhaustMap(() =>
            this.api.grilla(codigo).pipe(
              catchError((e: unknown) => {
                this.error.set(e instanceof ApiError ? e : new ApiError('No pudimos cargar los números. Inténtalo de nuevo.', -1));
                return EMPTY;
              }),
            ),
          ),
        ),
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((g) => this.aplicar(g));
  }

  protected alternar(numero: number): void {
    const resultado = this.carrito.alternar(numero);
    this.aviso.set(
      resultado === 'lleno'
        ? `Máximo ${this.rifa().maximoBoletosPorCompra} números por reserva. Quita uno para elegir otro.`
        : '',
    );
  }

  protected reintentar(): void {
    this.reintento.next();
  }

  private aplicar(g: GrillaBoletos): void {
    this.grilla.set(g);
    this.error.set(null);
    this.actualizadaEn.set(new Date());
    // Alguien más pudo quedarse con un número que tenías elegido: sale de la selección y se avisa.
    const perdidos = this.carrito.reconciliar(g.estados);
    if (perdidos.length) {
      const lista = perdidos.map((n) => formatearNumero(n, g.digitos ?? this.rifa().digitos)).join(', ');
      this.aviso.set(
        perdidos.length === 1
          ? `El número ${lista} ya no está disponible y salió de tu selección.`
          : `Los números ${lista} ya no están disponibles y salieron de tu selección.`,
      );
    }
  }

  /**
   * Cuándo pedir la grilla. Rifa abierta: de inmediato, cada 10 s y al volver a la pestaña, sin
   * consultar mientras está oculta (ahorra horas del servidor gratuito). Si no, una sola vez.
   * El botón "Reintentar" siempre fuerza una consulta.
   */
  private latidos(viva: boolean): Observable<unknown> {
    const manual = this.reintento.asObservable();
    if (!viva) return merge(of(0), manual);
    return merge(timer(0, INTERVALO_GRILLA_MS), fromEvent(document, 'visibilitychange'), manual).pipe(
      filter(() => !document.hidden),
      map(() => 0),
    );
  }
}
