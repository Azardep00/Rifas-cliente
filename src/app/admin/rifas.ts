import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../core/api/admin-api';
import { RifaGestion } from '../core/api/models';
import { etiquetaEstadoRifa, formatearEntero, formatearFechaHoraCorta, formatearMoneda } from '../core/formato';

/** Lista de rifas del organizador (CP-17). Los borradores se publican con un toque. */
@Component({
  selector: 'app-admin-rifas',
  imports: [RouterLink],
  template: `
    <h1>Rifas</h1>
    <a class="boton nueva" routerLink="/admin/rifas/nueva">+ Nueva rifa</a>
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (cargando()) { <p role="status">Cargando…</p> }
    @for (r of rifas(); track r.id) {
      <article class="rifa">
        <div class="fila"><strong>{{ r.titulo }}</strong><em [class.borrador]="r.estado === 'BORRADOR'">{{ etiqueta(r.estado) }}</em></div>
        <span class="meta">{{ fmt(r.cantidadBoletos) }} boletos a {{ plata(r.precioBoleto) }} · sorteo {{ fecha(r.fechaSorteo) }}</span>
        <span class="meta">{{ fmt(r.disponibilidad.vendidos) }} vendidos · {{ fmt(r.disponibilidad.disponibles) }} libres</span>
        @if (r.estado === 'BORRADOR') {
          <button type="button" class="boton" (click)="publicar(r)" [disabled]="publicando() === r.id">{{ publicando() === r.id ? 'Publicando…' : 'Publicar' }}</button>
        } @else if (r.estado === 'PUBLICADA') {
          <a class="boton boton--secundario" [routerLink]="['/rifa', r.codigo]">Ver página pública</a>
        }
      </article>
    } @empty {
      @if (!cargando()) { <p>Aún no hay rifas.</p> }
    }
  `,
  styles: `
    h1 { font-size: var(--t1); }
    .nueva { width: 100%; min-height: 3.5rem; margin-bottom: var(--e3); }
    .rifa { display: grid; gap: var(--e2); padding: var(--e3); margin-bottom: var(--e2); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .fila { display: flex; justify-content: space-between; gap: var(--e2); align-items: baseline; }
    em { font-style: normal; font-size: var(--t-1); font-weight: 600; color: var(--ok); white-space: nowrap; }
    em.borrador { color: var(--ambar); }
    .meta { color: var(--tinta-suave); font-size: var(--t-1); }
    .boton { min-height: 3rem; }
    .error { color: var(--error); font-weight: 600; }
    @media (min-width: 48rem) { .nueva { width: auto; } }
  `,
})
export class AdminRifas {
  private readonly api = inject(AdminApi);
  readonly rifas = signal<RifaGestion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly publicando = signal<number | null>(null);

  constructor() {
    this.api.misRifas().subscribe({
      next: (p) => { this.rifas.set(p.contenido); this.cargando.set(false); },
      error: (e: unknown) => { this.error.set(e instanceof Error ? e.message : 'No se pudo cargar.'); this.cargando.set(false); },
    });
  }

  publicar(r: RifaGestion): void {
    this.publicando.set(r.id);
    this.error.set(null);
    this.api.publicar(r.id).subscribe({
      next: (n) => { this.rifas.update((l) => l.map((x) => (x.id === n.id ? n : x))); this.publicando.set(null); },
      error: (e: unknown) => { this.error.set(e instanceof Error ? e.message : 'No se pudo publicar.'); this.publicando.set(null); },
    });
  }

  fmt = formatearEntero;
  plata = (n: number) => formatearMoneda(n);
  etiqueta = etiquetaEstadoRifa;
  fecha = formatearFechaHoraCorta;
}
