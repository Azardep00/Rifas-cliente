import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-cabecera',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="contenedor barra">
        <a class="marca" routerLink="/" aria-label="Alex Rifas, ir al inicio">Alex Rifas</a>
        <nav aria-label="Principal">
          <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Rifas</a>
          <a routerLink="/mis-boletos" routerLinkActive="activo">Mis boletos</a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    header { border-bottom: 1px dashed var(--linea); background: var(--papel); }
    .barra { display: flex; align-items: center; justify-content: space-between; gap: var(--e3); min-height: 4rem; }
    .marca {
      font: 800 var(--t1) var(--fuente-titulo); letter-spacing: -0.03em;
      color: var(--tinta); text-decoration: none;
    }
    nav { display: flex; gap: var(--e4); }
    nav a { color: var(--tinta-suave); text-decoration: none; font-weight: 600; padding-block: var(--e2); border-bottom: 3px solid transparent; }
    nav a:hover { color: var(--tinta); }
    nav a.activo { color: var(--tinta); border-bottom-color: var(--sol); }
  `,
})
export class Cabecera {}
