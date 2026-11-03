import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { Ganador, ReglaVacante, RifaDetalle } from '../core/api/models';
import { formatearNumero } from '../core/boletos';
import { formatearFechaHora } from '../core/formato';
import { AvisoCarga } from '../shared/aviso-carga';

/** Regla de cupo vacío (ADR-07): debe ser pública antes de vender y se repite junto al resultado. */
export function textoReglaVacante(regla: ReglaVacante | undefined): string {
  switch (regla) {
    case 'REPETIR_SIGUIENTE_LOTERIA': return 'Si el número que sale no se vendió, se repite el sorteo con el resultado de la siguiente lotería.';
    case 'ADJUDICAR_SIGUIENTE_VENDIDO': return 'Si el número que sale no se vendió, el premio pasa al siguiente número vendido.';
    default: return '';
  }
}

/**
 * Resultados y ganadores (/resultados/:codigo). La API solo responde ganadores cuando la rifa está SORTEADA
 * (antes da 404) y cada ganador trae `publicado`: aquí solo se muestran los publicados.
 */
@Component({
  selector: 'app-resultados',
  imports: [RouterLink, AvisoCarga],
  template: `
    <section class="contenedor">
      <a class="volver" [routerLink]="['/rifa', codigo()]">Volver a la rifa</a>

      <app-aviso-carga [cargando]="cargando()" [error]="errorCarga()" (reintentar)="cargar()">
        @if (rifa(); as r) {
          <h1>Resultados</h1>
          <p class="rifa-nombre">{{ r.titulo }}</p>

          @switch (r.estado) {
            @case ('SORTEADA') {
              @if (publicados().length) {
                <p class="lead">Estos son los números ganadores.</p>
                <ol class="ganadores" aria-label="Números ganadores">
                  @for (g of publicados(); track g.posicionPremio + '-' + g.numeroBoleto) {
                    <li>
                      <span class="puesto">Premio {{ g.posicionPremio }}</span>
                      <span class="premio">{{ g.premio }}</span>
                      <span class="numero" [attr.aria-label]="'Número ganador ' + texto(g.numeroBoleto)">{{ texto(g.numeroBoleto) }}</span>
                    </li>
                  }
                </ol>
                <p class="nota">
                  ¿Tenías este número? <a routerLink="/mis-boletos">Consulta tu reserva</a>; el organizador se comunica con quien resulte ganador.
                </p>
              } @else {
                <div class="vacio" role="status">
                  <p class="lead">El sorteo se realizó, pero el organizador aún no publica los ganadores.</p>
                  <p>Vuelve en un rato.</p>
                </div>
              }
            }
            @case ('CANCELADA') {
              <p class="lead" role="status">Esta rifa fue cancelada, por lo que no hay sorteo.</p>
            }
            @default {
              <div class="vacio" role="status">
                <p class="lead">Todavía no hay resultados.</p>
                <p>El sorteo está programado para el {{ fecha(r.fechaSorteo) }}.</p>
              </div>
            }
          }

          <section class="como" aria-labelledby="t-como">
            <h2 id="t-como">Cómo se define el ganador</h2>
            @if (r.metodoSorteo === 'LOTERIA') {
              <p>El ganador depende del resultado de {{ r.loteriaNombre || 'la lotería indicada' }}: gana el número que coincide con {{ r.digitos ? 'las últimas ' + r.digitos + ' cifras' : 'las últimas cifras' }} del número mayor.</p>
              @if (regla(); as t) { <p>{{ t }}</p> }
            } @else if (r.metodoSorteo === 'ALEATORIO') {
              <p>El ganador se elige al azar entre los números vendidos.</p>
            } @else {
              <p>El organizador define el número ganador y queda registrado en el sistema.</p>
            }
          </section>

          <div class="salidas"><a class="boton boton--secundario" [routerLink]="['/rifa', r.codigo]">Ver la rifa</a></div>
          <p class="nota">Proyecto de demostración: no se entrega ningún premio real.</p>
        }
      </app-aviso-carga>
    </section>
  `,
  styles: `
    section.contenedor { padding-block: var(--e4) var(--e6); }
    .volver { display: inline-block; margin-block: var(--e2) var(--e3); }
    .rifa-nombre { color: var(--tinta-suave); font-weight: 600; }
    .lead { font-size: var(--t1); font-family: var(--fuente-titulo); max-width: 40ch; }
    h2 { font-size: var(--t1); }
    .vacio { padding-block: var(--e3); }
    .ganadores { display: grid; gap: var(--e3); max-width: 34rem; margin: var(--e4) 0; padding: 0; list-style: none; }
    .ganadores li {
      display: grid; grid-template-columns: 1fr auto; gap: 0 var(--e3); align-items: center;
      padding: var(--e3) var(--e4); background: var(--sol); color: var(--sol-texto);
      border: 2px solid var(--tinta); border-radius: var(--radio);
    }
    .puesto { font-size: var(--t-1); font-weight: 700; grid-column: 1; }
    .premio { font: 700 var(--t0) var(--fuente-titulo); grid-column: 1; overflow-wrap: anywhere; }
    .numero { grid-column: 2; grid-row: 1 / span 2; font: 800 var(--t2) var(--fuente-titulo); letter-spacing: 0.02em; }
    .como { margin-top: var(--e5); max-width: 48ch; }
    .salidas { margin-top: var(--e4); }
    .nota { margin: var(--e3) 0 0; font-size: var(--t-1); color: var(--tinta-suave); max-width: 60ch; }
  `,
})
export class Resultados {
  private readonly api = inject(ApiService);
  private readonly titulo = inject(Title);

  /** Parámetro de ruta `:codigo` (withComponentInputBinding). */
  readonly codigo = input.required<string>();

  protected readonly rifa = signal<RifaDetalle | null>(null);
  private readonly ganadores = signal<Ganador[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<ApiError | null>(null);

  protected readonly publicados = computed(() =>
    this.ganadores()
      .filter((g) => g.publicado)
      .sort((a, b) => a.posicionPremio - b.posicionPremio || a.numeroBoleto - b.numeroBoleto),
  );
  protected readonly regla = computed(() => textoReglaVacante(this.rifa()?.reglaVacante));

  constructor() {
    effect(() => { this.codigo(); this.cargar(); });
  }

  protected texto(n: number): string { return formatearNumero(n, this.rifa()?.digitos); }
  protected fecha(iso: string): string { return formatearFechaHora(iso); }

  protected cargar(): void {
    const codigo = this.codigo();
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.rifa.set(null);
    this.ganadores.set([]);
    this.api.rifa(codigo).pipe(
      switchMap((r) =>
        r.estado !== 'SORTEADA'
          ? of({ r, g: [] as Ganador[] })
          : this.api.ganadores(codigo).pipe(
              // 404 = «el sorteo aún no está publicado»: no es un error de la pantalla.
              catchError((e: unknown) => (e instanceof ApiError && e.estado === 404 ? of([] as Ganador[]) : throwError(() => e))),
              map((g) => ({ r, g })),
            ),
      ),
    ).subscribe({
      next: ({ r, g }) => {
        if (codigo !== this.codigo()) return; // llegó tarde: ya se navegó a otra rifa
        this.rifa.set(r);
        this.ganadores.set(g);
        this.titulo.setTitle(`Resultados · ${r.titulo} · Alex Rifas`);
        this.cargando.set(false);
      },
      error: (e: ApiError) => {
        if (codigo !== this.codigo()) return;
        this.errorCarga.set(e.estado === 404 ? new ApiError('Esta rifa no existe o ya no está disponible.', 404) : e);
        this.cargando.set(false);
      },
    });
  }
}
