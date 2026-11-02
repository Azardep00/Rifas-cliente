import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  template: `
    <section class="contenedor">
      <h1>No encontramos esta página</h1>
      <p>Revisa el enlace o vuelve al inicio para ver las rifas disponibles.</p>
      <a class="boton" routerLink="/">Ir al inicio</a>
    </section>
  `,
  styles: `section { padding-block: var(--e6); }`,
})
export class NoEncontrada {}
