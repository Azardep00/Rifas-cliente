import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Pantalla provisional de las rutas del plan que aún no se construyen. Se elimina al cerrar el CP-15. */
@Component({
  selector: 'app-pendiente',
  imports: [RouterLink],
  template: `
    <section class="contenedor">
      <h1>{{ pantalla }}</h1>
      <p>Esta pantalla se construye en el CP-{{ cp }}.</p>
      <a class="boton boton--secundario" routerLink="/">Volver al inicio</a>
    </section>
  `,
  styles: `section { padding-block: var(--e6); }`,
})
export class Pendiente {
  private readonly datos = inject(ActivatedRoute).snapshot.data;
  protected readonly pantalla: string = this.datos['pantalla'];
  protected readonly cp: number = this.datos['cp'];
}
