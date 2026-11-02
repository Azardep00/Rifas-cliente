import { Component, effect, input, output, signal } from '@angular/core';
import { ApiError } from '../core/api/api-error';

/**
 * Envuelve una pantalla con datos remotos: muestra "cargando" (con aviso si el servidor tarda: puede estar
 * despertando, ver plan de cold start), el error con reintento, o el contenido proyectado.
 */
@Component({
  selector: 'app-aviso-carga',
  template: `
    @if (cargando()) {
      <div class="aviso" role="status">
        <p>Cargando…</p>
        @if (lento()) {
          <p class="ayuda">El servidor está despertando. Puede tardar hasta un minuto la primera vez.</p>
        }
      </div>
    } @else if (error(); as e) {
      <div class="aviso" role="alert">
        <p class="titulo">{{ e.message }}</p>
        @if (e.estado !== 404) {
          <button class="boton boton--secundario" type="button" (click)="reintentar.emit()">Reintentar</button>
        }
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    .aviso { padding-block: var(--e5); }
    .titulo { font-weight: 600; }
    .ayuda { color: var(--tinta-suave); }
  `,
})
export class AvisoCarga {
  readonly cargando = input(false);
  readonly error = input<ApiError | null>(null);
  readonly reintentar = output<void>();

  protected readonly lento = signal(false);

  constructor() {
    effect((limpiar) => {
      if (!this.cargando()) return;
      const t = setTimeout(() => this.lento.set(true), 4000);
      limpiar(() => { clearTimeout(t); this.lento.set(false); });
    });
  }
}
