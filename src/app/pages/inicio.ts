import { Component } from '@angular/core';

/** Portada provisional del CP-11: fija el lenguaje visual (boleto de talonario). El listado real llega en el CP-12. */
@Component({
  selector: 'app-inicio',
  template: `
    <section class="contenedor hero">
      <div class="texto">
        <h1>Escoge tus números. Reserva con tu nombre y teléfono.</h1>
        <p>Sin crear cuenta. Tu reserva queda guardada unos minutos mientras pagas, y el sorteo se juega con la lotería.</p>
      </div>

      <figure class="boleto" aria-label="Ejemplo de boleto numerado">
        <div class="talon"><span class="numero">042</span></div>
        <figcaption class="cuerpo">
          <strong>Ejemplo de boleto</strong>
          <span>Los números llevan ceros a la izquierda y ganan según las últimas cifras de la lotería.</span>
        </figcaption>
      </figure>
    </section>
  `,
  styles: `
    .hero { display: grid; gap: var(--e5); padding-block: var(--e6); align-items: center; }
    @media (min-width: 56rem) { .hero { grid-template-columns: 1.1fr 1fr; } }
    .texto h1 { max-width: 14ch; }

    .boleto {
      --talon: 9.5rem;
      position: relative; margin: 0; overflow: hidden;
      display: grid; grid-template-columns: var(--talon) 1fr;
      background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio);
      transform: rotate(-2deg);
    }
    .boleto::before, .boleto::after {
      content: ''; position: absolute; left: calc(var(--talon) - 0.625rem);
      width: 1.25rem; height: 1.25rem; border-radius: 50%;
      background: var(--papel); border: 1px solid var(--linea);
    }
    .boleto::before { top: -0.7rem; }
    .boleto::after { bottom: -0.7rem; }
    .talon {
      display: grid; place-items: center; min-height: 11rem;
      background: var(--sol); color: var(--sol-texto);
      border-right: 2px dashed var(--tinta);
    }
    .numero { font: 800 3rem var(--fuente-titulo); letter-spacing: -0.04em; }
    .cuerpo { display: grid; align-content: center; gap: var(--e2); padding: var(--e4); }
    .cuerpo strong { font: 700 var(--t1) var(--fuente-titulo); }
    .cuerpo span { color: var(--tinta-suave); }
    @media (max-width: 30rem) { .boleto { --talon: 6.5rem; } .numero { font-size: 2rem; } }
  `,
})
export class Inicio {}
