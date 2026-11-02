import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { RifaResumen } from '../core/api/models';
import { etiquetaEstadoRifa, formatearFechaHoraCorta, formatearMoneda } from '../core/formato';
import { AvisoCarga } from '../shared/aviso-carga';
import { Progreso } from '../shared/progreso';

const TAMANO = 12;

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, AvisoCarga, Progreso],
  template: `
    <section class="contenedor">
      <header class="intro">
        <h1>Rifas abiertas</h1>
        <p>Escoge tus números y reserva con tu nombre y teléfono. No necesitas crear una cuenta.</p>
      </header>

      <app-aviso-carga [cargando]="cargando() && rifas().length === 0" [error]="rifas().length === 0 ? error() : null"
                       (reintentar)="cargar(0)">
        @if (rifas().length === 0) {
          <p class="vacio">Todavía no hay rifas abiertas. Vuelve pronto.</p>
        } @else {
          <ul class="lista">
            @for (r of rifas(); track r.codigo) {
              <li>
                <article class="boleto">
                  <div class="talon">
                    <span class="precio">{{ precio(r) }}</span>
                    <span class="por">por número</span>
                  </div>
                  <div class="cuerpo">
                    <h2><a [routerLink]="['/rifa', r.codigo]">{{ r.titulo }}</a></h2>
                    @if (r.estado !== 'PUBLICADA') { <p class="estado">{{ estado(r) }}</p> }
                    <p class="fecha">Sorteo: {{ fecha(r) }}</p>
                    <app-progreso [total]="r.cantidadBoletos" [disponibles]="r.boletosDisponibles" />
                  </div>
                </article>
              </li>
            }
          </ul>

          @if (hayMas()) {
            <div class="mas">
              <button class="boton boton--secundario" type="button" [disabled]="cargando()" (click)="cargar(pagina() + 1)">
                {{ cargando() ? 'Cargando…' : 'Ver más rifas' }}
              </button>
              @if (error(); as e) { <p role="alert" class="fallo">{{ e.message }}</p> }
            </div>
          }
        }
      </app-aviso-carga>
    </section>
  `,
  styles: `
    .intro { padding-block: var(--e5) var(--e4); }
    .lista { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--e4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); }
    .boleto {
      --talon: 8.5rem;
      position: relative; overflow: hidden; height: 100%;
      display: grid; grid-template-columns: var(--talon) 1fr;
      background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio);
    }
    .boleto::before, .boleto::after {
      content: ''; position: absolute; left: calc(var(--talon) - 0.5rem); width: 1rem; height: 1rem;
      border-radius: 50%; background: var(--papel); border: 1px solid var(--linea);
    }
    .boleto::before { top: -0.55rem; }
    .boleto::after { bottom: -0.55rem; }
    .boleto:hover { border-color: var(--accion); }
    .boleto:focus-within { border-color: var(--accion); }
    .talon {
      display: grid; align-content: center; justify-items: center; gap: var(--e1); padding: var(--e3) var(--e2);
      background: var(--sol); color: var(--sol-texto); border-right: 2px dashed var(--tinta); text-align: center;
    }
    .precio { font: 800 1.2rem var(--fuente-titulo); letter-spacing: -0.03em; white-space: nowrap; }
    .por { font-size: var(--t-1); }
    .cuerpo { padding: var(--e3) var(--e4); display: grid; align-content: start; gap: var(--e2); }
    h2 { font-size: var(--t1); margin: 0; }
    h2 a { color: var(--tinta); text-decoration: none; }
    h2 a::after { content: ''; position: absolute; inset: 0; }
    .estado { margin: 0; font-weight: 700; color: var(--ambar); }
    .fecha { margin: 0; color: var(--tinta-suave); font-size: var(--t-1); }
    .mas { display: grid; justify-items: center; gap: var(--e2); padding-block: var(--e5); }
    .fallo { color: var(--error); margin: 0; }
    .vacio { padding-block: var(--e5); }
  `,
})
export class Inicio {
  private readonly api = inject(ApiService);

  protected readonly rifas = signal<RifaResumen[]>([]);
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() { this.cargar(0); }

  protected hayMas(): boolean { return this.pagina() + 1 < this.totalPaginas(); }
  protected precio(r: RifaResumen): string { return formatearMoneda(r.precioBoleto, r.moneda); }
  protected fecha(r: RifaResumen): string { return formatearFechaHoraCorta(r.fechaSorteo); }
  protected estado(r: RifaResumen): string { return etiquetaEstadoRifa(r.estado); }

  protected cargar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.rifas(pagina, TAMANO).subscribe({
      next: (p) => {
        this.rifas.update((actuales) => (pagina === 0 ? p.contenido : [...actuales, ...p.contenido]));
        this.pagina.set(p.pagina);
        this.totalPaginas.set(p.totalPaginas);
        this.cargando.set(false);
      },
      error: (e: ApiError) => { this.error.set(e); this.cargando.set(false); },
    });
  }
}
