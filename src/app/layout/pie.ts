import { Component } from '@angular/core';

@Component({
  selector: 'app-pie',
  template: `
    <footer>
      <div class="contenedor">
        <p>Proyecto académico de demostración. No se vende ningún boleto con dinero real.</p>
      </div>
    </footer>
  `,
  styles: `
    footer { border-top: 1px dashed var(--linea); padding-block: var(--e4); color: var(--tinta-suave); font-size: var(--t-1); }
    p { margin: 0; }
  `,
})
export class Pie {}
