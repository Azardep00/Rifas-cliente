import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Sesion } from '../core/auth/sesion';

/**
 * Marco del panel. Pensado para celular: barra superior corta y navegación inferior con zonas táctiles de 48 px+.
 * Cada checkpoint siguiente agrega su entrada a `secciones` (Rifas CP-17, Pagos CP-18, Sorteo CP-19).
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="arriba">
      <div class="quien">
        <strong>Panel</strong>
        <span>{{ sesion.usuario()?.nombre }} · {{ sesion.rol() === 'ADMIN' ? 'Administrador' : 'Organizador' }}</span>
      </div>
      <button type="button" class="salir" (click)="salir()">Salir</button>
    </header>
    <main id="contenido" tabindex="-1"><router-outlet /></main>
    <nav class="abajo" aria-label="Panel">
      @for (s of secciones(); track s.ruta) {
        <a [routerLink]="s.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: s.ruta === '/admin' }">{{ s.texto }}</a>
      }
    </nav>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; background: var(--papel); }
    .arriba { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center; gap: var(--e3);
      padding: var(--e2) var(--gutter); padding-top: max(var(--e2), env(safe-area-inset-top));
      background: var(--superficie); border-bottom: 1px solid var(--linea); }
    .quien { display: grid; line-height: 1.25; min-width: 0; }
    .quien span { color: var(--tinta-suave); font-size: var(--t-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .salir { min-height: 2.75rem; min-width: 4.5rem; border: 2px solid var(--linea); border-radius: var(--radio); background: transparent; color: var(--tinta); font: 600 var(--t0) var(--fuente-texto); cursor: pointer; }
    main { flex: 1; width: min(var(--ancho), 100% - 2 * var(--gutter)); margin-inline: auto; padding-block: var(--e4) 6rem; outline: none; }
    .abajo { position: fixed; inset: auto 0 0 0; z-index: 5; display: flex; background: var(--superficie); border-top: 1px solid var(--linea);
      padding-bottom: env(safe-area-inset-bottom); }
    .abajo a { flex: 1; display: grid; place-items: center; min-height: 3.5rem; color: var(--tinta-suave); text-decoration: none; font-weight: 600; border-top: 3px solid transparent; }
    .abajo a.activo { color: var(--tinta); border-top-color: var(--sol); }
    @media (min-width: 48rem) {
      .abajo { position: static; justify-content: center; border-top: 0; border-bottom: 1px solid var(--linea); order: -1; }
      .abajo a { flex: 0 0 9rem; }
      main { padding-bottom: var(--e5); }
    }
  `,
})
export class AdminLayout {
  readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  /** Pagos es solo de ADMIN: la API de cobros lo exige, así que al organizador ni se le muestra. */
  readonly secciones = computed(() => [
    { ruta: '/admin', texto: 'Resumen' },
    { ruta: '/admin/rifas', texto: 'Rifas' },
    ...(this.sesion.rol() === 'ADMIN' ? [{ ruta: '/admin/pagos', texto: 'Pagos' }] : []),
  ]);

  salir(): void {
    this.sesion.salir().subscribe(() => void this.router.navigate(['/admin/login']));
  }
}
