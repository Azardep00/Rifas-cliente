import { Injectable, computed, signal } from '@angular/core';

/** Datos de la rifa que el carrito necesita para validar y calcular el total. */
export interface ConfigCarrito {
  codigo: string;
  precio: number;
  moneda: string;
  /** `maximoBoletosPorCompra` de la rifa: la API rechaza reservas con más números. */
  maximo: number;
  digitos?: number | null;
}

export type ResultadoAlternar = 'agregado' | 'quitado' | 'lleno' | 'sin-rifa';

const CLAVE_ALMACEN = 'alex-rifas:carrito';

/** 30000 + 'COP' -> "$ 30.000" (sin decimales: los precios de boleto son enteros). */
export function formatearDinero(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(valor);
  } catch {
    return `${valor} ${moneda}`; // código de moneda inválido: no romper la pantalla
  }
}

/**
 * Selección de números de UNA rifa a la vez. Vive en la raíz porque el checkout (CP-14, otra ruta)
 * la lee. Se guarda en sessionStorage para sobrevivir a un F5, pero la grilla la reconcilia
 * contra el estado real (`reconciliar`) porque el almacén puede traer números que ya se ocuparon.
 */
@Injectable({ providedIn: 'root' })
export class Carrito {
  private readonly _config = signal<ConfigCarrito | null>(null);
  private readonly _numeros = signal<readonly number[]>([]);

  readonly config = this._config.asReadonly();
  /** Siempre ordenados de menor a mayor. */
  readonly numeros = this._numeros.asReadonly();
  readonly cantidad = computed(() => this._numeros().length);
  readonly total = computed(() => this.cantidad() * (this._config()?.precio ?? 0));
  readonly lleno = computed(() => {
    const c = this._config();
    return !!c && this.cantidad() >= c.maximo;
  });

  /**
   * Debe llamarse al mostrar una rifa. Si es otra rifa distinta a la del carrito, lo vacía
   * (no se mezclan números de rifas distintas); si es la misma, recupera la selección guardada.
   */
  configurar(config: ConfigCarrito): void {
    const previo = this._config();
    this._config.set(config);
    if (previo?.codigo === config.codigo) {
      this._numeros.update((n) => n.slice(0, Math.max(0, config.maximo)));
      this.guardar();
      return;
    }
    this._numeros.set(this.leer(config.codigo).slice(0, Math.max(0, config.maximo)));
    this.guardar();
  }

  contiene(numero: number): boolean {
    return this._numeros().includes(numero);
  }

  alternar(numero: number): ResultadoAlternar {
    const c = this._config();
    if (!c) return 'sin-rifa';
    if (this.contiene(numero)) {
      this.quitar(numero);
      return 'quitado';
    }
    if (this.cantidad() >= c.maximo) return 'lleno';
    this._numeros.update((n) => [...n, numero].sort((a, b) => a - b));
    this.guardar();
    return 'agregado';
  }

  quitar(numero: number): void {
    this._numeros.update((n) => n.filter((x) => x !== numero));
    this.guardar();
  }

  vaciar(): void {
    this._numeros.set([]);
    this.guardar();
  }

  /**
   * Saca de la selección los números que ya no están libres según `GrillaBoletos.estados`
   * (L/R/V por posición). Devuelve los que se quitaron para avisar a la persona.
   */
  reconciliar(estados: string): number[] {
    const quitados = this._numeros().filter((n) => estados.charAt(n) !== 'L');
    if (quitados.length) {
      this._numeros.update((n) => n.filter((x) => !quitados.includes(x)));
      this.guardar();
    }
    return quitados;
  }

  private guardar(): void {
    const c = this._config();
    try {
      if (c && this._numeros().length) {
        sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify({ codigo: c.codigo, numeros: this._numeros() }));
      } else {
        sessionStorage.removeItem(CLAVE_ALMACEN);
      }
    } catch {
      /* sessionStorage bloqueado (modo privado): el carrito sigue funcionando en memoria */
    }
  }

  private leer(codigo: string): number[] {
    try {
      const crudo = sessionStorage.getItem(CLAVE_ALMACEN);
      if (!crudo) return [];
      const dato: unknown = JSON.parse(crudo);
      if (typeof dato !== 'object' || dato === null) return [];
      const { codigo: guardado, numeros } = dato as { codigo?: unknown; numeros?: unknown };
      if (guardado !== codigo || !Array.isArray(numeros)) return [];
      const validos = numeros.filter((n): n is number => Number.isInteger(n) && n >= 0);
      return [...new Set(validos)].sort((a, b) => a - b);
    } catch {
      return [];
    }
  }
}
