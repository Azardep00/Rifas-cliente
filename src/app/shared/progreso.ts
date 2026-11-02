import { Component, computed, input } from '@angular/core';
import { formatearEntero, porcentajeOcupado } from '../core/formato';

/** Barra de avance de ventas: números ya no libres (vendidos o reservados) sobre el total. */
@Component({
  selector: 'app-progreso',
  template: `
    <div class="barra" role="progressbar" aria-label="Avance de ventas"
         aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="porcentaje()">
      <div class="relleno" [style.width.%]="porcentaje()"></div>
    </div>
    <p class="texto">
      @if (disponibles() === 0) { Todos los números están tomados }
      @else { Quedan <strong>{{ entero(disponibles()) }}</strong> de {{ entero(total()) }} números }
    </p>
  `,
  styles: `
    .barra { height: 0.625rem; border-radius: 99px; background: var(--linea); overflow: hidden; }
    .relleno { height: 100%; background: var(--accion); border-radius: 99px; }
    .texto { margin: var(--e2) 0 0; font-size: var(--t-1); color: var(--tinta-suave); }
    .texto strong { color: var(--tinta); }
  `,
})
export class Progreso {
  readonly total = input.required<number>();
  readonly disponibles = input.required<number>();
  protected readonly entero = formatearEntero;
  protected readonly porcentaje = computed(() => porcentajeOcupado(this.total(), this.disponibles()));
}
