import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Cabecera } from './layout/cabecera';
import { Pie } from './layout/pie';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Cabecera, Pie],
  template: `
    @if (esPanel()) {
      <router-outlet />
    } @else {
      <a class="saltar" href="#contenido">Saltar al contenido</a>
      <app-cabecera />
      <main id="contenido" tabindex="-1"><router-outlet /></main>
      <app-pie />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    main { flex: 1; outline: none; }
    .saltar {
      position: absolute; left: var(--e3); top: -4rem; z-index: 10;
      background: var(--accion); color: var(--accion-texto); padding: var(--e2) var(--e3); border-radius: var(--radio);
    }
    .saltar:focus { top: var(--e3); }
  `,
})
export class App {
  private readonly router = inject(Router);
  /** El panel trae su propio marco: sin cabecera ni pie públicos. */
  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  readonly esPanel = () => /^\/admin(\/|\?|$)/.test(this.url());
}
