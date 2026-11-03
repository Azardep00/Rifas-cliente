import { Component, inject } from '@angular/core';
import { Sesion } from '../core/auth/sesion';

/** Pantalla de entrada del panel. El dashboard real con cifras llega en el CP-17. */
@Component({
  selector: 'app-admin-resumen',
  template: `
    <h1>Hola, {{ sesion.usuario()?.nombre }}</h1>
    <p>Aquí vas a crear rifas, confirmar pagos y cargar el resultado de la lotería. Esas pantallas llegan en los próximos pasos.</p>
  `,
  styles: `h1 { font-size: var(--t2); }`,
})
export class AdminResumen {
  readonly sesion = inject(Sesion);
}
