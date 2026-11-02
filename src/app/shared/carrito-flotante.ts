import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatearNumero } from '../core/boletos';
import { Carrito, formatearDinero } from '../core/carrito';

/** Barra fija al pie con la selección: números (se pueden quitar), total y paso al checkout (CP-14). */
@Component({
  selector: 'app-carrito-flotante',
  imports: [RouterLink],
  template: `
    @if (carrito.cantidad() > 0 && carrito.config(); as config) {
      <aside class="barra" aria-label="Tu selección de números">
        <div class="contenedor interior">
          <div class="resumen">
            <p class="total" aria-live="polite">
              <strong>{{ carrito.cantidad() }} {{ carrito.cantidad() === 1 ? 'número' : 'números' }}</strong>
              · {{ total() }}
              @if (carrito.lleno()) {
                <span class="tope">Llegaste al máximo de {{ config.maximo }} por reserva.</span>
              }
            </p>
            <ul class="fichas">
              @for (n of carrito.numeros(); track n) {
                <li>
                  <button type="button" class="ficha" (click)="carrito.quitar(n)"
                          [attr.aria-label]="'Quitar el número ' + texto(n)">
                    {{ texto(n) }} <span aria-hidden="true">×</span>
                  </button>
                </li>
              }
            </ul>
          </div>
          <div class="acciones">
            <button type="button" class="boton boton--secundario" (click)="carrito.vaciar()">Vaciar</button>
            <a class="boton" [routerLink]="['/rifa', config.codigo, 'reservar']">Reservar</a>
          </div>
        </div>
      </aside>
    }
  `,
  styles: `
    .barra {
      position: fixed; inset: auto 0 0 0; z-index: 20;
      background: var(--superficie); border-top: 2px solid var(--tinta);
      box-shadow: 0 -0.5rem 1.5rem color-mix(in srgb, var(--tinta) 14%, transparent);
      padding-block: var(--e3);
      /* Zona segura de celulares con barra de gestos. */
      padding-bottom: max(var(--e3), env(safe-area-inset-bottom));
    }
    .interior { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--e3); }
    .resumen { flex: 1 1 18rem; min-width: 0; }
    .total { margin: 0 0 var(--e2); max-width: none; font: 600 var(--t0) var(--fuente-texto); }
    .tope { display: block; color: var(--ambar); font-size: var(--t-1); font-weight: 500; }

    .fichas { display: flex; gap: var(--e2); margin: 0; padding: 0 0 var(--e1); list-style: none; overflow-x: auto; }
    .ficha {
      flex: none; min-height: 2.25rem; padding: 0 var(--e3); border-radius: 999px; cursor: pointer;
      border: 2px solid var(--tinta); background: var(--sol); color: var(--sol-texto);
      font: 700 var(--t-1) var(--fuente-titulo);
    }
    .ficha:hover { filter: brightness(0.95); }

    .acciones { display: flex; gap: var(--e2); }
    @media (max-width: 30rem) {
      .acciones { width: 100%; }
      .acciones .boton { flex: 1; }
    }
  `,
})
export class CarritoFlotante {
  protected readonly carrito = inject(Carrito);

  protected readonly total = computed(() => formatearDinero(this.carrito.total(), this.carrito.config()?.moneda ?? 'COP'));

  protected texto(numero: number): string {
    return formatearNumero(numero, this.carrito.config()?.digitos);
  }
}
