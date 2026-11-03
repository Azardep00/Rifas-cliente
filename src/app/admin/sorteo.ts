import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../core/api/admin-api';
import { ResultadoLoteria, RifaGestion, SorteoLoteria } from '../core/api/models';
import { claseResolucion, describirPaso, diaLoteria, etiquetaRegla } from './sorteo-texto';

/**
 * Sorteo (CP-19), paso 2: previsualizar → verificar resultados si falta → confirmar. Mobile-first: una columna,
 * botón principal grande al final, confirmación dentro de la página (sin ventanas emergentes).
 * La previsualización no guarda nada; "Ejecutar" es definitivo (la API lo hace atómico) y publica a los ganadores.
 */
@Component({
  selector: 'app-admin-sorteo',
  imports: [RouterLink],
  template: `
    <a class="volver" routerLink="/admin/sorteo">← Sorteo</a>
    @if (cargandoRifa()) { <p role="status">Cargando…</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    @if (rifa(); as r) {
      <h1>{{ r.titulo }}</h1>

      @if (hecho(); as h) {
        <section class="listo" aria-live="polite">
          <h2>¡Sorteo realizado!</h2>
          <p>La rifa quedó sorteada y los ganadores ya son públicos.</p>
          <ol class="ganadores">
            @for (g of h.ganadores; track g.posicionPremio) {
              <li><span class="premio">{{ g.premio }}</span><span class="num">{{ g.numeroBoletoTexto }}</span></li>
            }
          </ol>
          <a class="boton" [routerLink]="['/resultados', r.codigo]">Ver página de resultados</a>
        </section>
      } @else {
        <p class="ayuda">{{ regla() }}</p>
        @if (cargandoPrevia()) { <p role="status">Calculando ganadores…</p> }

        @if (previa(); as p) {
          <p class="estado" [class.bien]="p.completo" role="status">{{ p.mensaje }}</p>

          <h2>Qué pasaría</h2>
          <ol class="pasos">
            @for (s of p.pasos; track s.posicionPremio + '-' + s.resultadoId) {
              <li [attr.data-clase]="clase(s)">
                <strong>Premio {{ s.posicionPremio }}</strong>
                <span>{{ texto(s) }}</span>
                <small>Lotería del {{ dia(s.fechaSorteoLoteria) }}</small>
              </li>
            } @empty { <li class="vacia">Aún no hay resultados verificados para decidir un premio.</li> }
          </ol>

          @if (p.completo) {
            <h2>Ganadores</h2>
            <ol class="ganadores">
              @for (g of p.ganadores; track g.posicionPremio) {
                <li>
                  <span class="premio">{{ g.premio }}@if (g.adjudicadoPorVacante) { <small>por cupo vacío</small> }</span>
                  <span class="num">{{ g.numeroBoletoTexto }}</span>
                </li>
              }
            </ol>
          }
        }

        @if (pendientes().length) {
          <h2>Resultados por verificar</h2>
          <p class="ayuda">Compáralos con la fuente oficial antes de verificar.</p>
          @for (x of pendientes(); track x.id) {
            <div class="resultado">
              <span><strong class="num">{{ x.numeroMayor }}</strong> · {{ dia(x.fechaSorteo) }}</span>
              <button type="button" class="boton boton--secundario" (click)="verificar(x)" [disabled]="verificando() === x.id">{{ verificando() === x.id ? 'Verificando…' : 'Verificar' }}</button>
            </div>
          }
        }

        <div class="barra">
          <button type="button" class="boton boton--secundario" (click)="previsualizar()" [disabled]="cargandoPrevia() || ejecutando()">Actualizar</button>
          @if (confirmando()) {
            <div class="panel">
              <p><strong>Esto es definitivo.</strong> Se publican los ganadores y no se puede repetir el sorteo.</p>
              <div class="acciones">
                <button type="button" class="boton peligro" (click)="ejecutar()" [disabled]="ejecutando()">{{ ejecutando() ? 'Sorteando…' : 'Sí, sortear' }}</button>
                <button type="button" class="boton boton--secundario" (click)="confirmando.set(false)" [disabled]="ejecutando()">Cancelar</button>
              </div>
            </div>
          } @else {
            <button type="button" class="boton" (click)="confirmando.set(true)" [disabled]="!previa()?.completo || cargandoPrevia()">Ejecutar sorteo</button>
          }
        </div>
      }
    }
  `,
  styles: `
    .volver { display: inline-flex; align-items: center; min-height: 2.75rem; color: var(--accion); font-weight: 600; text-decoration: none; }
    h1 { font-size: var(--t1); margin: 0 0 var(--e2); overflow-wrap: anywhere; }
    h2 { font-size: var(--t0); margin: var(--e4) 0 var(--e2); }
    .ayuda { color: var(--tinta-suave); font-size: var(--t-1); margin: 0 0 var(--e2); }
    .estado { padding: var(--e3); border-radius: var(--radio); background: color-mix(in srgb, var(--ambar) 16%, var(--superficie)); border: 1px solid var(--ambar); font-weight: 600; }
    .estado.bien { background: color-mix(in srgb, var(--ok) 14%, var(--superficie)); border-color: var(--ok); }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--e2); }
    .pasos li { display: grid; gap: var(--e1); padding: var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-left-width: 5px; border-radius: var(--radio); }
    .pasos li[data-clase='ok'] { border-left-color: var(--ok); }
    .pasos li[data-clase='aviso'] { border-left-color: var(--ambar); }
    .pasos li[data-clase='repite'] { border-left-color: var(--error); }
    .pasos small, .premio small { display: block; color: var(--tinta-suave); font-size: var(--t-1); }
    .vacia { color: var(--tinta-suave); }
    .ganadores li { display: flex; justify-content: space-between; align-items: center; gap: var(--e3); padding: var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .premio { font-weight: 600; overflow-wrap: anywhere; }
    .num { font: 800 var(--t2, 1.5rem) var(--fuente-titulo); font-variant-numeric: tabular-nums; }
    .resultado { display: flex; justify-content: space-between; align-items: center; gap: var(--e3); padding: var(--e3); margin-bottom: var(--e2); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .resultado .num { font-size: var(--t1); }
    .barra { display: grid; gap: var(--e2); margin-top: var(--e4); }
    .boton { display: grid; place-items: center; min-height: 3.5rem; padding-inline: var(--e3); text-align: center; text-decoration: none; }
    .boton:disabled { opacity: 0.55; cursor: not-allowed; }
    .peligro { background: var(--error); color: #fff; }
    .panel { display: grid; gap: var(--e3); padding: var(--e3); background: var(--papel); border: 2px solid var(--error); border-radius: var(--radio); }
    .panel p { margin: 0; }
    .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e2); }
    .listo { display: grid; gap: var(--e3); }
    .listo h2 { margin: 0; }
    .error { color: var(--error); font-weight: 600; }
    @media (min-width: 48rem) { :host { display: block; max-width: 36rem; } }
  `,
})
export class AdminSorteo implements OnInit {
  /** Viene de la ruta /admin/sorteo/:id (withComponentInputBinding). */
  readonly id = input.required<string>();
  private readonly api = inject(AdminApi);

  readonly rifa = signal<RifaGestion | null>(null);
  readonly previa = signal<SorteoLoteria | null>(null);
  readonly hecho = signal<SorteoLoteria | null>(null);
  readonly resultados = signal<ResultadoLoteria[]>([]);
  readonly cargandoRifa = signal(true);
  readonly cargandoPrevia = signal(false);
  readonly ejecutando = signal(false);
  readonly verificando = signal<number | null>(null);
  readonly confirmando = signal(false);
  readonly error = signal<string | null>(null);

  readonly pendientes = computed(() => this.resultados().filter((x) => x.estado === 'PENDIENTE_VERIFICACION'));
  readonly regla = computed(() => {
    const r = this.rifa();
    return r?.reglaVacante ? etiquetaRegla(r.reglaVacante) : '';
  });

  ngOnInit(): void {
    this.api.misRifas(0, 100).subscribe({
      next: (p) => {
        const r = p.contenido.find((x) => String(x.id) === this.id());
        this.cargandoRifa.set(false);
        if (!r) { this.error.set('No se encontró la rifa.'); return; }
        this.rifa.set(r);
        if (r.estado === 'CERRADA') { this.previsualizar(); this.cargarResultados(r); }
        else this.error.set(r.estado === 'SORTEADA' ? 'Esta rifa ya fue sorteada.' : 'Cierra las ventas de la rifa antes de sortear.');
      },
      error: (e: unknown) => { this.cargandoRifa.set(false); this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la rifa.'); },
    });
  }

  previsualizar(): void {
    const r = this.rifa();
    if (!r) return;
    this.cargandoPrevia.set(true);
    this.confirmando.set(false);
    this.error.set(null);
    this.api.previsualizarSorteo(r.id).subscribe({
      next: (p) => { this.previa.set(p); this.cargandoPrevia.set(false); },
      error: (e: unknown) => { this.cargandoPrevia.set(false); this.previa.set(null); this.error.set(e instanceof Error ? e.message : 'No se pudo previsualizar.'); },
    });
  }

  private cargarResultados(r: RifaGestion): void {
    if (!r.loteriaId) return;
    this.api.resultadosLoteria(r.loteriaId, 'PENDIENTE_VERIFICACION').subscribe({
      next: (p) => this.resultados.set(p.contenido),
      error: () => undefined, // la previsualización ya explica qué falta; esto es solo un atajo
    });
  }

  verificar(x: ResultadoLoteria): void {
    if (this.verificando()) return;
    this.verificando.set(x.id);
    this.error.set(null);
    this.api.verificarResultado(x.id).subscribe({
      next: () => {
        this.verificando.set(null);
        this.resultados.update((l) => l.filter((y) => y.id !== x.id));
        this.previsualizar();
      },
      error: (e: unknown) => { this.verificando.set(null); this.error.set(e instanceof Error ? e.message : 'No se pudo verificar.'); },
    });
  }

  ejecutar(): void {
    const r = this.rifa();
    if (!r || this.ejecutando()) return;
    this.ejecutando.set(true);
    this.error.set(null);
    this.api.ejecutarSorteo(r.id).subscribe({
      next: (s) => { this.ejecutando.set(false); this.confirmando.set(false); this.hecho.set(s); },
      error: (e: unknown) => {
        this.ejecutando.set(false);
        this.confirmando.set(false);
        this.error.set(e instanceof Error ? e.message : 'No se pudo ejecutar el sorteo.');
        this.previsualizar(); // 409: algo cambió; se muestra lo que dice hoy el servidor
      },
    });
  }

  texto = describirPaso;
  clase = claseResolucion;
  dia = diaLoteria;
}
