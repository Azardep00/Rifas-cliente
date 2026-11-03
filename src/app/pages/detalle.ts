import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { ReglaVacante, RifaDetalle } from '../core/api/models';
import {
  etiquetaEstadoRifa, formatearDuracion, formatearFechaHora, formatearMoneda,
} from '../core/formato';
import { AvisoCarga } from '../shared/aviso-carga';
import { GrillaRifa } from '../shared/grilla-rifa';
import { Progreso } from '../shared/progreso';

/** Texto público de la regla de cupo vacío (ADR-07: debe conocerse antes de comprar). Refleja las reglas del CP-09. */
const REGLAS: Record<ReglaVacante, string> = {
  REPETIR_SIGUIENTE_LOTERIA:
    'Si el número que sale no se vendió, ese resultado se descarta y el premio espera al siguiente sorteo de la misma lotería.',
  ADJUDICAR_SIGUIENTE_VENDIDO:
    'Si el número que sale no se vendió, gana el siguiente número vendido que aún no tenga premio, en orden ascendente y volviendo al inicio si hace falta.',
};

@Component({
  selector: 'app-detalle',
  imports: [RouterLink, AvisoCarga, Progreso, GrillaRifa],
  template: `
    <section class="contenedor">
      <a class="volver" routerLink="/">Todas las rifas</a>

      <app-aviso-carga [cargando]="cargando()" [error]="error()" (reintentar)="cargar()">
        @if (rifa(); as r) {
          <div class="cabeza">
            <h1>{{ r.titulo }}</h1>
            <p class="estado" [class.abierta]="r.estado === 'PUBLICADA'">{{ estado() }}</p>
          </div>

          <div class="columnas">
            <div class="principal">
              @if (r.imagenUrl) { <img class="foto" [src]="r.imagenUrl" alt="" loading="lazy" /> }
              @if (r.descripcion) { <p class="descripcion">{{ r.descripcion }}</p> }

              <div id="numeros" class="zona-numeros">
                <app-grilla-rifa [rifa]="r" />
              </div>

              <h2>Premios</h2>
              <ol class="premios">
                @for (p of r.premios; track p.posicion) {
                  <li>
                    <span class="pos" aria-label="Premio {{ p.posicion }}">{{ p.posicion }}</span>
                    <div>
                      <strong>{{ p.nombre }}</strong>
                      @if (p.valorEstimado) { <span class="valor">Valor aproximado {{ moneda(p.valorEstimado) }}</span> }
                      @if (p.descripcion) { <p>{{ p.descripcion }}</p> }
                    </div>
                  </li>
                } @empty {
                  <li>Los premios se publicarán pronto.</li>
                }
              </ol>

              <h2>Cómo se decide el ganador</h2>
              @switch (r.metodoSorteo) {
                @case ('LOTERIA') {
                  <p>
                    Se juega con {{ r.loteriaNombre ?? 'una lotería colombiana' }}.
                    @if (r.digitos) { Gana el número formado por las últimas {{ r.digitos }} cifras del premio mayor. }
                    Cada premio se decide con un sorteo distinto de la lotería, en orden de fecha.
                  </p>
                  @if (regla(); as texto) { <p><strong>Si el número no se vendió.</strong> {{ texto }}</p> }
                }
                @case ('ALEATORIO') { <p>El sistema elige los ganadores al azar entre los números vendidos.</p> }
                @default { <p>El organizador registra el número ganador después del sorteo.</p> }
              }
            </div>

            <aside class="panel" aria-label="Resumen de compra">
              <p class="precio">{{ moneda(r.precioBoleto) }} <span>por número</span></p>
              <app-progreso [total]="r.cantidadBoletos" [disponibles]="r.disponibilidad.disponibles" />
              <dl>
                <dt>Sorteo</dt><dd>{{ fecha(r.fechaSorteo) }}</dd>
                <dt>Ventas hasta</dt><dd>{{ fecha(r.cierreVentasEn) }}</dd>
                <dt>Máximo por compra</dt><dd>{{ r.maximoBoletosPorCompra }} números</dd>
                <dt>Organiza</dt><dd>{{ r.organizador }}</dd>
              </dl>

              @switch (r.estado) {
                @case ('PUBLICADA') {
                  <a class="boton" [routerLink]="['/rifa', r.codigo]" fragment="numeros">Escoger números</a>
                  <p class="nota">Tu reserva dura {{ duracion() }}. Si en ese tiempo no se confirma el pago, los números vuelven a quedar libres.</p>
                }
                @case ('SORTEADA') { <a class="boton" [routerLink]="['/resultados', r.codigo]">Ver resultados</a> }
                @case ('CANCELADA') { <p class="nota">Esta rifa fue cancelada.</p> }
                @default { <p class="nota">Las ventas están cerradas.</p> }
              }
            </aside>
          </div>
        }
      </app-aviso-carga>
    </section>
  `,
  styles: `
    .volver { display: inline-block; margin-block: var(--e4) var(--e3); }
    .cabeza { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--e2) var(--e4); }
    .estado { margin: 0; font-weight: 700; color: var(--ambar); }
    .estado.abierta { color: var(--ok); }
    .columnas { display: grid; gap: var(--e5); align-items: start; padding-bottom: var(--e6); }
    @media (min-width: 56rem) { .columnas { grid-template-columns: 1fr 22rem; } .panel { position: sticky; top: var(--e4); } }
    .zona-numeros { scroll-margin-top: var(--e4); }
    .foto { width: 100%; max-height: 24rem; object-fit: cover; border-radius: var(--radio); margin-bottom: var(--e4); }
    .descripcion { white-space: pre-line; }
    h2 { font-size: var(--t1); margin-top: var(--e5); }
    .premios { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--e3); }
    .premios li { display: flex; gap: var(--e3); align-items: start; }
    .premios p { margin: var(--e1) 0 0; color: var(--tinta-suave); }
    .pos {
      flex: none; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%;
      background: var(--sol); color: var(--sol-texto); font: 800 1rem var(--fuente-titulo);
    }
    .valor { display: block; color: var(--tinta-suave); font-size: var(--t-1); }
    .panel { background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); padding: var(--e4); }
    .precio { font: 800 var(--t2) var(--fuente-titulo); letter-spacing: -0.03em; margin-bottom: var(--e3); }
    .precio span { font: 500 var(--t-1) var(--fuente-texto); color: var(--tinta-suave); letter-spacing: 0; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: var(--e2) var(--e3); margin: var(--e4) 0; font-size: var(--t-1); }
    dt { color: var(--tinta-suave); }
    dd { margin: 0; font-weight: 600; }
    .panel .boton { width: 100%; }
    .nota { margin: var(--e3) 0 0; font-size: var(--t-1); color: var(--tinta-suave); }
  `,
})
export class Detalle {
  private readonly api = inject(ApiService);
  private readonly titulo = inject(Title);

  /** Parámetro de ruta `:codigo` (withComponentInputBinding). */
  readonly codigo = input.required<string>();

  protected readonly rifa = signal<RifaDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly regla = computed(() => {
    const r = this.rifa()?.reglaVacante;
    return r ? REGLAS[r] : null;
  });
  protected readonly estado = computed(() => etiquetaEstadoRifa(this.rifa()?.estado ?? ''));
  protected readonly duracion = computed(() => formatearDuracion(this.rifa()?.reservaMinutos ?? 15));

  constructor() {
    effect(() => { this.codigo(); this.cargar(); });
  }

  protected moneda(v: number): string { return formatearMoneda(v, this.rifa()?.moneda); }
  protected fecha(iso: string): string { return formatearFechaHora(iso); }

  protected cargar(): void {
    const codigo = this.codigo();
    this.cargando.set(true);
    this.error.set(null);
    this.rifa.set(null);
    this.api.rifa(codigo).subscribe({
      next: (r) => {
        if (codigo !== this.codigo()) return; // llegó tarde: ya se navegó a otra rifa
        this.rifa.set(r);
        this.titulo.setTitle(`${r.titulo} · Alex Rifas`);
        this.cargando.set(false);
      },
      error: (e: ApiError) => {
        if (codigo !== this.codigo()) return;
        this.error.set(e.estado === 404 ? new ApiError('Esta rifa no existe o ya no está disponible.', 404) : e);
        this.cargando.set(false);
      },
    });
  }
}
