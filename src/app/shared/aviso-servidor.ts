import { Component, computed, inject } from '@angular/core';
import { SEGUNDOS_LARGO, Servidor } from '../core/servidor';

/**
 * "Despertando el servidor" (CP-20). Pensado para celular: hoja anclada abajo (alcance del pulgar) con
 * fondo atenuado; en pantallas anchas queda centrada. No muestra errores: solo explica la espera y
 * el reintento es automático. Pasado 1 min ofrece recargar.
 */
@Component({
  selector: 'app-aviso-servidor',
  template: `
    @if (servidor.despertando()) {
      <div class="velo">
        <section class="hoja" role="status" aria-live="polite" aria-labelledby="aviso-servidor-titulo">
          <div class="boleto" aria-hidden="true">
            <span class="barra"></span>
          </div>
          <h2 id="aviso-servidor-titulo">Despertando el servidor</h2>
          @if (largo()) {
            <p>Está tardando más de lo normal. Seguimos intentando; si prefieres, recarga la página.</p>
            <button class="boton" type="button" (click)="recargar()">Recargar la página</button>
          } @else {
            <p>La primera visita tarda cerca de 1 minuto. Deja esta pantalla abierta: reintentamos solos.</p>
          }
          <p class="tiempo" aria-hidden="true">{{ servidor.segundos() }} s</p>
        </section>
      </div>
    }
  `,
  styles: `
    .velo {
      position: fixed; inset: 0; z-index: 40;
      display: flex; align-items: flex-end; justify-content: center;
      background: color-mix(in srgb, var(--tinta) 55%, transparent);
    }
    .hoja {
      width: 100%; max-width: 30rem;
      background: var(--superficie); color: var(--tinta);
      border-radius: var(--radio) var(--radio) 0 0;
      padding: var(--e4) var(--gutter);
      padding-bottom: max(var(--e4), env(safe-area-inset-bottom));
      box-shadow: 0 -0.5rem 2rem rgb(0 0 0 / 0.25);
    }
    .hoja h2 { font-size: var(--t1); margin-bottom: var(--e2); }
    .hoja p { margin-bottom: var(--e3); }
    .tiempo { color: var(--tinta-suave); font-size: var(--t-1); margin: var(--e3) 0 0; }
    .boton { width: 100%; min-height: 3.5rem; }
    .boleto {
      height: 0.5rem; margin-bottom: var(--e3); overflow: hidden;
      border-radius: 999px; background: var(--linea);
    }
    .barra {
      display: block; height: 100%; width: 40%; border-radius: inherit; background: var(--accion);
      animation: ir 1.4s ease-in-out infinite;
    }
    @keyframes ir { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
    @media (prefers-reduced-motion: reduce) {
      .barra { animation: none; width: 100%; opacity: 0.6; }
    }
    @media (min-width: 40rem) {
      .velo { align-items: center; }
      .hoja { border-radius: var(--radio); padding-bottom: var(--e4); }
    }
  `,
})
export class AvisoServidor {
  protected readonly servidor = inject(Servidor);
  protected readonly largo = computed(() => this.servidor.segundos() >= SEGUNDOS_LARGO);

  protected recargar(): void {
    location.reload();
  }
}
