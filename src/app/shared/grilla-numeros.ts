import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { EstadoNumero, decodificarGrilla, formatearNumero } from '../core/boletos';

/** Se pinta de a 100 casillas: 10 000 botones a la vez harían lenta la página en celulares. */
export const NUMEROS_POR_BLOQUE = 100;

const ANCHO_CASILLA_PX = 56;
const SEPARACION_PX = 8;
const COLUMNAS_POR_DEFECTO = 10;

interface Casilla {
  numero: number;
  texto: string;
  estado: EstadoNumero;
  elegida: boolean;
  etiqueta: string;
}

/**
 * Cuadrícula de números (solo presentación): recibe `estados` (L/R/V por posición) y la selección,
 * y avisa con `alternar` cuando se toca un número libre. Teclado: flechas, Inicio/Fin y
 * RePág/AvPág (cambian de bloque); Enter o Espacio eligen. Solo una casilla entra en el orden de
 * tabulación (roving tabindex) para no obligar a recorrer 100 botones con Tab.
 */
@Component({
  selector: 'app-grilla-numeros',
  template: `
    @if (bloques() > 1) {
      <div class="navegador">
        <button type="button" class="boton boton--secundario paso" (click)="irABloque(bloque() - 1)"
                [disabled]="bloque() === 0" aria-label="Bloque anterior">‹</button>
        <label class="solo-lectores" for="selector-bloque">Bloque de números</label>
        <select #selector id="selector-bloque" (change)="irABloque(+selector.value)">
          @for (o of opciones(); track o.indice) {
            <option [value]="o.indice" [selected]="o.indice === bloque()">{{ o.texto }}</option>
          }
        </select>
        <button type="button" class="boton boton--secundario paso" (click)="irABloque(bloque() + 1)"
                [disabled]="bloque() >= bloques() - 1" aria-label="Bloque siguiente">›</button>

        <form class="ir" (submit)="ir($event, campo.value); campo.select()">
          <label for="ir-a">Ir al número</label>
          <input #campo id="ir-a" type="text" inputmode="numeric" autocomplete="off" [placeholder]="ejemplo()"
                 [attr.aria-invalid]="errorIr() ? 'true' : null" [attr.aria-describedby]="errorIr() ? 'error-ir' : null" />
          <button type="submit" class="boton boton--secundario">Ir</button>
        </form>
      </div>
      @if (errorIr()) {
        <p id="error-ir" class="error-ir" role="alert">{{ errorIr() }}</p>
      }
    }

    <div #rejilla class="rejilla" role="group" [attr.aria-label]="'Números ' + rango()"
         [style.--cols]="columnas()" (keydown)="teclado($event)">
      @for (c of casillas(); track c.numero) {
        <button type="button" class="casilla" [class]="c.estado" [class.elegida]="c.elegida"
                [attr.data-n]="c.numero" [attr.aria-label]="c.etiqueta"
                [attr.aria-pressed]="c.estado === 'libre' ? c.elegida : null"
                [attr.aria-disabled]="c.estado !== 'libre' || soloLectura() ? 'true' : null"
                [tabindex]="c.numero === numeroConFoco() ? 0 : -1" (click)="clic(c)">
          {{ c.texto }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .navegador { display: flex; flex-wrap: wrap; align-items: center; gap: var(--e2); margin-bottom: var(--e3); }
    .navegador select {
      min-height: 2.75rem; padding-inline: var(--e3); border-radius: var(--radio);
      border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); font: inherit;
    }
    .paso { min-width: 2.75rem; padding-inline: 0; font-size: var(--t1); line-height: 1; }
    .paso:disabled { opacity: 0.4; cursor: not-allowed; }
    .ir { display: flex; align-items: center; gap: var(--e2); margin-left: auto; }
    .ir label { font-size: var(--t-1); color: var(--tinta-suave); }
    .ir input {
      width: 6.5rem; min-height: 2.75rem; padding-inline: var(--e3); border-radius: var(--radio);
      border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); font: inherit;
    }
    .ir input[aria-invalid='true'] { border-color: var(--error); }
    .error-ir { color: var(--error); font-size: var(--t-1); margin: 0 0 var(--e2); }

    .rejilla { display: grid; grid-template-columns: repeat(var(--cols, 10), minmax(0, 1fr)); gap: 0.5rem; }

    .casilla {
      min-height: 2.75rem; padding: 0; border-radius: 0.5rem; cursor: pointer;
      border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta);
      font: 700 var(--t0) var(--fuente-titulo); letter-spacing: -0.01em;
    }
    .casilla.libre:hover { border-color: var(--accion); }
    /* Elegida: color + borde grueso + marca, para que no dependa solo del color. */
    .casilla.elegida { background: var(--sol); color: var(--sol-texto); border-color: var(--tinta); box-shadow: inset 0 0 0 2px var(--tinta); }
    /* Reservada: borde discontinuo ámbar. Vendida: tachada y rayada. */
    .casilla.reservado { border: 2px dashed var(--ambar); color: var(--ambar); cursor: not-allowed; }
    .casilla.vendido {
      color: var(--vendido); text-decoration: line-through; cursor: not-allowed;
      background: repeating-linear-gradient(135deg, transparent 0 5px, var(--linea) 5px 6px);
    }
    .casilla[aria-disabled='true'].libre { cursor: default; }
  `,
})
export class GrillaNumeros {
  /** `GrillaBoletos.estados`: un carácter por número (L libre, R reservado, V vendido). */
  readonly estados = input.required<string>();
  readonly digitos = input<number | null | undefined>();
  readonly seleccionados = input<readonly number[]>([]);
  /** Rifa cerrada/sorteada: se ve la grilla pero no se puede elegir. */
  readonly soloLectura = input(false);

  readonly alternar = output<number>();

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rejilla = viewChild<ElementRef<HTMLElement>>('rejilla');

  protected readonly bloqueActual = signal(0);
  protected readonly columnas = signal(COLUMNAS_POR_DEFECTO);
  protected readonly errorIr = signal('');
  private readonly foco = signal<number | null>(null);

  private readonly cantidad = computed(() => this.estados().length);
  protected readonly bloques = computed(() => Math.max(1, Math.ceil(this.cantidad() / NUMEROS_POR_BLOQUE)));
  /** Si la grilla se achicara entre refrescos, nunca se apunta a un bloque inexistente. */
  protected readonly bloque = computed(() => Math.min(this.bloqueActual(), this.bloques() - 1));
  private readonly inicio = computed(() => this.bloque() * NUMEROS_POR_BLOQUE);
  private readonly fin = computed(() => Math.min(this.cantidad(), this.inicio() + NUMEROS_POR_BLOQUE));

  protected readonly ejemplo = computed(() => formatearNumero(Math.min(42, Math.max(0, this.cantidad() - 1)), this.digitos()));
  protected readonly rango = computed(() => this.textoRango(this.inicio(), this.fin() - 1));

  protected readonly opciones = computed(() => {
    const estados = this.estados();
    return Array.from({ length: this.bloques() }, (_, indice) => {
      const ini = indice * NUMEROS_POR_BLOQUE;
      const fin = Math.min(estados.length, ini + NUMEROS_POR_BLOQUE);
      let libres = 0;
      for (let i = ini; i < fin; i++) if (estados.charAt(i) === 'L') libres++;
      return { indice, texto: `${this.textoRango(ini, fin - 1)} · ${libres} ${libres === 1 ? 'libre' : 'libres'}` };
    });
  });

  protected readonly casillas = computed<Casilla[]>(() => {
    const elegidos = new Set(this.seleccionados());
    const ini = this.inicio();
    const estados = decodificarGrilla(this.estados().slice(ini, this.fin()));
    return estados.map((estado, i) => {
      const numero = ini + i;
      const texto = formatearNumero(numero, this.digitos());
      const elegida = estado === 'libre' && elegidos.has(numero);
      const detalle = elegida ? 'tu selección' : estado === 'libre' ? 'libre' : estado === 'reservado' ? 'reservado por otra persona' : 'vendido';
      return { numero, texto, estado, elegida, etiqueta: `Número ${texto}, ${detalle}` };
    });
  });

  /** Única casilla tabulable: la última con foco si está en este bloque; si no, la primera. */
  protected readonly numeroConFoco = computed(() => {
    const f = this.foco();
    return f !== null && f >= this.inicio() && f < this.fin() ? f : this.inicio();
  });

  constructor() {
    // Número de columnas según el ancho real: las flechas arriba/abajo necesitan saberlo.
    afterNextRender(() => {
      const el = this.rejilla()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const medir = () => {
        const ancho = el.clientWidth;
        if (ancho <= 0) return;
        const cols = Math.floor((ancho + SEPARACION_PX) / (ANCHO_CASILLA_PX + SEPARACION_PX));
        this.columnas.set(Math.max(2, Math.min(COLUMNAS_POR_DEFECTO, cols)));
      };
      const observador = new ResizeObserver(medir);
      observador.observe(el);
      this.destroyRef.onDestroy(() => observador.disconnect());
      medir();
    });
  }

  protected clic(c: Casilla): void {
    this.foco.set(c.numero);
    if (this.soloLectura() || c.estado !== 'libre') return;
    this.alternar.emit(c.numero);
  }

  protected irABloque(indice: number): void {
    this.bloqueActual.set(Math.max(0, Math.min(this.bloques() - 1, indice)));
    this.foco.set(null);
  }

  protected ir(evento: Event, texto: string): void {
    evento.preventDefault();
    const limpio = texto.trim();
    if (!/^\d+$/.test(limpio) || Number(limpio) >= this.cantidad()) {
      const ultimo = formatearNumero(this.cantidad() - 1, this.digitos());
      this.errorIr.set(`Escribe un número entre ${formatearNumero(0, this.digitos())} y ${ultimo}.`);
      return;
    }
    this.errorIr.set('');
    this.moverFoco(Number(limpio));
  }

  protected teclado(e: KeyboardEvent): void {
    const boton = (e.target as HTMLElement).closest<HTMLElement>('button[data-n]');
    if (!boton || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = Number(boton.dataset['n']);
    const cols = this.columnas();
    const destinos: Record<string, number> = {
      ArrowRight: n + 1,
      ArrowLeft: n - 1,
      ArrowDown: n + cols,
      ArrowUp: n - cols,
      Home: this.inicio(),
      End: this.fin() - 1,
      PageDown: n + NUMEROS_POR_BLOQUE,
      PageUp: n - NUMEROS_POR_BLOQUE,
    };
    const destino = destinos[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    this.moverFoco(Math.max(0, Math.min(this.cantidad() - 1, destino)));
  }

  /** Muestra el bloque del número y le da el foco cuando ya esté pintado. */
  private moverFoco(numero: number): void {
    this.bloqueActual.set(Math.floor(numero / NUMEROS_POR_BLOQUE));
    this.foco.set(numero);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`button[data-n="${numero}"]`)?.focus(),
      { injector: this.injector },
    );
  }

  private textoRango(desde: number, hasta: number): string {
    return `${formatearNumero(desde, this.digitos())} a ${formatearNumero(hasta, this.digitos())}`;
  }
}
