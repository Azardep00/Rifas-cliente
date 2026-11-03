import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../core/api/admin-api';
import { RifaGestion } from '../core/api/models';
import { Sesion } from '../core/auth/sesion';
import { etiquetaEstadoRifa, formatearEntero, formatearFechaHoraCorta, formatearMoneda, porcentajeOcupado } from '../core/formato';

/** Dashboard (CP-17). Cifras desde RifaGestionDto: vendidos × precio es el recaudo confirmado de boletos vendidos. */
@Component({
  selector: 'app-admin-resumen',
  imports: [RouterLink],
  template: `
    <h1>Hola, {{ sesion.usuario()?.nombre }}</h1>
    <a class="boton nueva" routerLink="/admin/rifas/nueva">+ Nueva rifa</a>

    @if (cargando()) { <p role="status">Cargando…</p> }
    @else if (fallo()) { <p class="error" role="alert">{{ fallo() }} <button type="button" class="enlace" (click)="cargar()">Reintentar</button></p> }
    @else {
      <section class="cifras" aria-label="Resumen">
        <div><strong>{{ activas().length }}</strong><span>Rifas activas</span></div>
        <div><strong>{{ fmt(vendidos()) }}</strong><span>Boletos vendidos</span></div>
        <div><strong>{{ plata(recaudo()) }}</strong><span>Recaudo confirmado</span></div>
        <div><strong>{{ fmt(reservados()) }}</strong><span>Reservados ahora</span></div>
      </section>

      @if (borradores().length) {
        <p class="aviso">Tienes {{ borradores().length }} {{ borradores().length === 1 ? 'borrador' : 'borradores' }} sin publicar. <a routerLink="/admin/rifas">Verlos</a></p>
      }

      <h2>Activas</h2>
      @for (r of activas(); track r.id) {
        <a class="rifa" [routerLink]="['/rifa', r.codigo]">
          <span class="fila"><strong>{{ r.titulo }}</strong><em>{{ etiqueta(r.estado) }}</em></span>
          <span class="barra" aria-hidden="true"><span [style.width.%]="pct(r)"></span></span>
          <span class="meta">{{ fmt(r.disponibilidad.vendidos) }} vendidos · {{ fmt(r.disponibilidad.reservados) }} reservados · {{ fmt(r.disponibilidad.disponibles) }} libres</span>
          <span class="meta">Sorteo: {{ fecha(r.fechaSorteo) }}</span>
        </a>
      } @empty {
        <p>No tienes rifas activas. Crea la primera con el botón de arriba.</p>
      }
    }
  `,
  styles: `
    h1 { font-size: var(--t1); }
    h2 { font-size: var(--t1); margin-top: var(--e4); }
    .nueva { width: 100%; min-height: 3.5rem; margin-bottom: var(--e4); }
    .cifras { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e2); }
    .cifras div { display: grid; gap: 2px; padding: var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .cifras strong { font: 700 var(--t1) var(--fuente-titulo); overflow-wrap: anywhere; }
    .cifras span { color: var(--tinta-suave); font-size: var(--t-1); }
    .aviso { margin-top: var(--e3); padding: var(--e2) var(--e3); background: var(--superficie); border-left: 4px solid var(--sol); border-radius: var(--radio); }
    .rifa { display: grid; gap: var(--e2); padding: var(--e3); margin-bottom: var(--e2); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); color: var(--tinta); text-decoration: none; }
    .fila { display: flex; justify-content: space-between; gap: var(--e2); align-items: baseline; }
    .fila em { font-style: normal; color: var(--ok); font-size: var(--t-1); font-weight: 600; white-space: nowrap; }
    .barra { height: 0.5rem; background: var(--linea); border-radius: 1rem; overflow: hidden; }
    .barra span { display: block; height: 100%; background: var(--sol); }
    .meta { color: var(--tinta-suave); font-size: var(--t-1); }
    .error { color: var(--error); font-weight: 600; }
    .enlace { min-height: 2.75rem; background: none; border: 0; color: var(--accion); font: 600 var(--t0) var(--fuente-texto); text-decoration: underline; cursor: pointer; }
    @media (min-width: 48rem) { .cifras { grid-template-columns: repeat(4, 1fr); } .nueva { width: auto; } }
  `,
})
export class AdminResumen {
  readonly sesion = inject(Sesion);
  private readonly api = inject(AdminApi);

  readonly rifas = signal<RifaGestion[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal<string | null>(null);

  readonly activas = computed(() => this.rifas().filter((r) => r.estado === 'PUBLICADA' || r.estado === 'CERRADA'));
  readonly borradores = computed(() => this.rifas().filter((r) => r.estado === 'BORRADOR'));
  readonly vendidos = computed(() => this.rifas().reduce((s, r) => s + r.disponibilidad.vendidos, 0));
  readonly reservados = computed(() => this.activas().reduce((s, r) => s + r.disponibilidad.reservados, 0));
  /** Solo rifas en COP se suman entre sí; otras monedas no se mezclan. */
  readonly recaudo = computed(() => this.rifas().filter((r) => r.moneda === 'COP').reduce((s, r) => s + r.disponibilidad.vendidos * r.precioBoleto, 0));

  constructor() { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.misRifas().subscribe({
      next: (p) => { this.rifas.set(p.contenido); this.cargando.set(false); },
      error: (e: unknown) => { this.fallo.set(e instanceof Error ? e.message : 'No se pudo cargar.'); this.cargando.set(false); },
    });
  }

  fmt = formatearEntero;
  plata = (n: number) => formatearMoneda(n);
  etiqueta = etiquetaEstadoRifa;
  fecha = formatearFechaHoraCorta;
  pct = (r: RifaGestion) => porcentajeOcupado(r.cantidadBoletos, r.disponibilidad.disponibles);
}
