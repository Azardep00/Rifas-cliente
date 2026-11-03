import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../core/api/admin-api';
import { RifaGestion } from '../core/api/models';
import { etiquetaEstadoRifa, formatearEntero, formatearFechaHoraCorta } from '../core/formato';

/**
 * Sorteo (CP-19), paso 1: qué rifas por lotería están en qué punto. Una rifa se sortea en este orden:
 * ventas abiertas → "Cerrar ventas" → "Sortear" → sorteada. Pensado para el celular.
 */
@Component({
  selector: 'app-sorteo-lista',
  imports: [RouterLink],
  template: `
    <h1>Sorteo</h1>
    <p class="ayuda">Rifas que se sortean con el resultado de una lotería.</p>
    @if (aviso(); as a) { <p class="aviso" role="status" aria-live="polite">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (cargando()) { <p role="status">Cargando…</p> }

    @for (r of rifas(); track r.id) {
      <article class="rifa">
        <div class="fila"><strong>{{ r.titulo }}</strong><em [attr.data-estado]="r.estado">{{ etiqueta(r.estado) }}</em></div>
        <span class="meta">{{ fmt(r.disponibilidad.vendidos) }} vendidos de {{ fmt(r.cantidadBoletos) }} · sorteo {{ fecha(r.fechaSorteo) }}</span>
        @if (r.disponibilidad.reservados > 0) {
          <span class="meta alerta">{{ r.disponibilidad.reservados }} reservados sin pagar: confírmalos o libéralos antes de sortear.</span>
        }

        @if (r.estado === 'PUBLICADA') {
          @if (confirmando() === r.id) {
            <section class="panel">
              <p class="ayuda">Se dejan de vender números. No se puede reabrir.</p>
              <div class="acciones">
                <button type="button" class="boton peligro" (click)="cerrar(r)" [disabled]="enviando() === r.id">{{ enviando() === r.id ? 'Cerrando…' : 'Sí, cerrar ventas' }}</button>
                <button type="button" class="boton boton--secundario" (click)="confirmando.set(null)" [disabled]="enviando() === r.id">Cancelar</button>
              </div>
            </section>
          } @else {
            <button type="button" class="boton" (click)="confirmando.set(r.id)">Cerrar ventas</button>
          }
        } @else if (r.estado === 'CERRADA') {
          <a class="boton" [routerLink]="['/admin/sorteo', r.id]">Preparar sorteo</a>
        } @else if (r.estado === 'SORTEADA') {
          <a class="boton boton--secundario" [routerLink]="['/resultados', r.codigo]">Ver resultados públicos</a>
        }
      </article>
    } @empty {
      @if (!cargando() && !error()) { <p class="vacio">Aún no hay rifas por lotería publicadas.</p> }
    }
  `,
  styles: `
    h1 { font-size: var(--t1); margin-bottom: var(--e1); }
    .ayuda { margin: 0 0 var(--e3); color: var(--tinta-suave); font-size: var(--t-1); }
    .rifa { display: grid; gap: var(--e2); padding: var(--e3); margin-bottom: var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .fila { display: flex; justify-content: space-between; gap: var(--e2); align-items: baseline; }
    em { font-style: normal; font-size: var(--t-1); font-weight: 700; white-space: nowrap; color: var(--ok); }
    em[data-estado='PUBLICADA'] { color: var(--ambar); }
    .meta { color: var(--tinta-suave); font-size: var(--t-1); }
    .alerta { color: var(--error); font-weight: 600; }
    .boton { display: grid; place-items: center; min-height: 3.25rem; text-align: center; text-decoration: none; }
    .boton:disabled { opacity: 0.55; cursor: not-allowed; }
    .peligro { background: var(--error); color: #fff; }
    .panel { display: grid; gap: var(--e3); padding: var(--e3); background: var(--papel); border-radius: var(--radio); }
    .panel .ayuda { margin: 0; }
    .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e2); }
    .aviso { padding: var(--e3); border-radius: var(--radio); background: color-mix(in srgb, var(--ok) 14%, var(--superficie)); border: 1px solid var(--ok); font-weight: 600; }
    .error { color: var(--error); font-weight: 600; }
    .vacio { text-align: center; color: var(--tinta-suave); padding-block: var(--e5); }
    @media (min-width: 48rem) { .rifa { max-width: 36rem; } }
  `,
})
export class SorteoLista {
  private readonly api = inject(AdminApi);
  readonly rifas = signal<RifaGestion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly confirmando = signal<number | null>(null);
  readonly enviando = signal<number | null>(null);

  constructor() {
    this.api.misRifas(0, 100).subscribe({
      next: (p) => {
        // Solo las que se sortean por lotería y ya salieron de borrador; las que esperan sorteo, primero.
        const orden = { CERRADA: 0, PUBLICADA: 1, SORTEADA: 2 } as Record<string, number>;
        this.rifas.set(
          p.contenido.filter((r) => r.metodoSorteo === 'LOTERIA' && r.estado in orden).sort((a, b) => orden[a.estado] - orden[b.estado]),
        );
        this.cargando.set(false);
      },
      error: (e: unknown) => { this.error.set(e instanceof Error ? e.message : 'No se pudo cargar.'); this.cargando.set(false); },
    });
  }

  cerrar(r: RifaGestion): void {
    if (this.enviando()) return;
    this.enviando.set(r.id);
    this.error.set(null);
    this.api.cerrar(r.id).subscribe({
      next: (n) => {
        this.rifas.update((l) => l.map((x) => (x.id === n.id ? n : x)));
        this.enviando.set(null);
        this.confirmando.set(null);
        this.aviso.set(`Ventas cerradas en «${n.titulo}». Ya puedes preparar el sorteo.`);
      },
      error: (e: unknown) => {
        this.enviando.set(null);
        this.error.set(e instanceof Error ? e.message : 'No se pudo cerrar la rifa.');
      },
    });
  }

  fmt = formatearEntero;
  etiqueta = etiquetaEstadoRifa;
  fecha = formatearFechaHoraCorta;
}
