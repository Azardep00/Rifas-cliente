import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApi, FiltroCompras } from '../core/api/admin-api';
import { CompraAdmin, EstadoCompra } from '../core/api/models';
import { formatearNumero } from '../core/boletos';
import { formatearFechaHoraCorta, formatearMoneda } from '../core/formato';
import { METODOS_PAGO, enlaceWhatsapp, interpretarBusqueda, telefonoParaMostrar } from './pagos-busqueda';

type Accion = { codigo: string; modo: 'confirmar' | 'liberar' };

const FILTROS: { estado: EstadoCompra | null; texto: string }[] = [
  { estado: 'PENDIENTE', texto: 'Pendientes' },
  { estado: 'CONFIRMADA', texto: 'Confirmadas' },
  { estado: 'EXPIRADA', texto: 'Vencidas' },
  { estado: 'CANCELADA', texto: 'Canceladas' },
  { estado: null, texto: 'Todas' },
];

/**
 * Cola de pagos (CP-18), pensada para el celular: el administrador atiende reservas con el pulgar.
 * Cada tarjeta trae llamar/WhatsApp, y confirmar/liberar se abren dentro de la misma tarjeta (sin ventanas
 * emergentes). Las pendientes salen primero las que vencen antes, como ordena la API.
 */
@Component({
  selector: 'app-admin-pagos',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Pagos</h1>

    <form class="buscar" (submit)="buscar($event)" role="search">
      <input type="search" name="q" [(ngModel)]="texto" inputmode="search" enterkeyhint="search" autocomplete="off"
        placeholder="Celular o número de boleto" aria-label="Buscar por celular o número de boleto" />
      <button type="submit" class="boton">Buscar</button>
    </form>
    @if (errorBusqueda(); as m) { <p class="error" role="alert">{{ m }}</p> }

    <div class="filtros" role="group" aria-label="Estado de la reserva">
      @for (f of filtros; track f.texto) {
        <button type="button" class="chip" [class.on]="f.estado === estado()" [attr.aria-pressed]="f.estado === estado()" (click)="elegir(f.estado)">{{ f.texto }}</button>
      }
    </div>

    <div class="barra">
      <span role="status">{{ cargando() && !items().length ? 'Cargando…' : resumen() }}</span>
      <button type="button" class="enlace" (click)="cargar(true)" [disabled]="cargando()">Actualizar</button>
    </div>

    @if (aviso(); as a) { <p class="aviso" role="status" aria-live="polite">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    @for (c of items(); track c.codigo) {
      <article class="compra" [class.urgente]="c.estado === 'PENDIENTE' && minutosRestantes(c) <= 5">
        <div class="fila">
          <strong class="quien">{{ c.compradorNombre || 'Cliente con cuenta' }}</strong>
          <em [attr.data-estado]="c.estado">{{ etiqueta(c.estado) }}</em>
        </div>

        <div class="numeros" [attr.aria-label]="'Números de la reserva ' + c.codigo">
          @for (n of c.numeros; track n) { <span class="num">{{ num(c, n) }}</span> }
        </div>

        <div class="datos">
          <span>{{ plata(c) }} · {{ c.numeros.length }} {{ c.numeros.length === 1 ? 'número' : 'números' }}</span>
          @if (c.estado === 'PENDIENTE') {
            <span class="vence" [class.rojo]="minutosRestantes(c) <= 5">{{ vence(c) }}</span>
          } @else {
            <span>{{ fecha(c.actualizadaEn) }}</span>
          }
          <span class="codigo">Código {{ c.codigo }}@if (c.codigoRifa) { · <a [routerLink]="['/rifa', c.codigoRifa]">Rifa {{ c.codigoRifa }}</a> }</span>
        </div>

        @if (c.compradorTelefono) {
          <div class="contacto">
            <a class="tel" [href]="'tel:' + c.compradorTelefono">📞 {{ telefono(c) }}</a>
            @if (wa(c); as w) { <a class="wa" [href]="w" target="_blank" rel="noopener">WhatsApp</a> }
          </div>
        }

        @if (c.estado === 'PENDIENTE') {
          @if (abierta()?.codigo === c.codigo && abierta()?.modo === 'confirmar') {
            <section class="panel" aria-label="Confirmar pago">
              <p class="ayuda">¿Cómo llegó el pago? Verifícalo en tu app o banco antes de confirmar.</p>
              <div class="metodos" role="group" aria-label="Método de pago">
                @for (m of metodos; track m) {
                  <button type="button" class="chip" [class.on]="metodo() === m" [attr.aria-pressed]="metodo() === m" (click)="metodo.set(m)">{{ m }}</button>
                }
              </div>
              <label class="campo">Nota (opcional)
                <input type="text" name="obs" [(ngModel)]="observacion" maxlength="500" placeholder="Ej. comprobante 8841" autocomplete="off" />
              </label>
              <div class="acciones">
                <button type="button" class="boton" (click)="confirmar(c)" [disabled]="!metodo() || enviando() === c.codigo">{{ enviando() === c.codigo ? 'Confirmando…' : 'Confirmar pago' }}</button>
                <button type="button" class="boton boton--secundario" (click)="cerrar()" [disabled]="enviando() === c.codigo">Cancelar</button>
              </div>
            </section>
          } @else if (abierta()?.codigo === c.codigo && abierta()?.modo === 'liberar') {
            <section class="panel" aria-label="Liberar reserva">
              <p class="ayuda">Los números vuelven a estar libres para otros compradores.</p>
              <label class="campo">Motivo (opcional)
                <input type="text" name="motivo" [(ngModel)]="motivo" maxlength="500" placeholder="Ej. no respondió" autocomplete="off" />
              </label>
              <div class="acciones">
                <button type="button" class="boton peligro" (click)="liberar(c)" [disabled]="enviando() === c.codigo">{{ enviando() === c.codigo ? 'Liberando…' : 'Sí, liberar' }}</button>
                <button type="button" class="boton boton--secundario" (click)="cerrar()" [disabled]="enviando() === c.codigo">Cancelar</button>
              </div>
            </section>
          } @else {
            <div class="acciones">
              <button type="button" class="boton" (click)="abrir(c, 'confirmar')">Confirmar pago</button>
              <button type="button" class="boton boton--secundario" (click)="abrir(c, 'liberar')">Liberar</button>
            </div>
          }
        }
      </article>
    } @empty {
      @if (!cargando() && !error()) { <p class="vacio">No hay reservas con este filtro.</p> }
    }

    @if (hayMas()) {
      <button type="button" class="boton boton--secundario mas" (click)="masPaginas()" [disabled]="cargando()">{{ cargando() ? 'Cargando…' : 'Cargar más' }}</button>
    }
  `,
  styles: `
    h1 { font-size: var(--t1); margin-bottom: var(--e3); }
    .buscar { display: grid; grid-template-columns: 1fr auto; gap: var(--e2); }
    input { width: 100%; min-height: 3rem; padding: 0 var(--e3); font: 400 1rem var(--fuente-texto); color: var(--tinta); background: var(--superficie); border: 2px solid var(--linea); border-radius: var(--radio); }
    input:focus-visible { outline: 3px solid var(--accion); outline-offset: 1px; }
    .boton { min-height: 3rem; padding-inline: var(--e3); }
    .boton:disabled { opacity: 0.55; cursor: not-allowed; }
    .peligro { background: var(--error); color: #fff; }
    .filtros, .metodos { display: flex; gap: var(--e2); overflow-x: auto; padding-block: var(--e3) var(--e2); scrollbar-width: none; scroll-snap-type: x proximity; }
    .filtros::-webkit-scrollbar, .metodos::-webkit-scrollbar { display: none; }
    .metodos { flex-wrap: wrap; overflow: visible; padding-top: 0; }
    .chip { flex: none; min-height: 2.75rem; padding: 0 var(--e3); border: 2px solid var(--linea); border-radius: 999px; background: var(--superficie); color: var(--tinta); font: 600 var(--t0) var(--fuente-texto); cursor: pointer; scroll-snap-align: start; }
    .chip.on { background: var(--tinta); color: var(--superficie); border-color: var(--tinta); }
    .barra { display: flex; justify-content: space-between; align-items: center; color: var(--tinta-suave); font-size: var(--t-1); min-height: 2.5rem; }
    .enlace { min-height: 2.75rem; padding: 0 var(--e2); background: none; border: 0; color: var(--accion); font: 600 var(--t0) var(--fuente-texto); cursor: pointer; }
    .aviso { padding: var(--e3); border-radius: var(--radio); background: color-mix(in srgb, var(--ok) 14%, var(--superficie)); border: 1px solid var(--ok); color: var(--tinta); font-weight: 600; }
    .error { color: var(--error); font-weight: 600; }
    .compra { display: grid; gap: var(--e3); padding: var(--e3); margin-bottom: var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .compra.urgente { border-color: var(--error); box-shadow: inset 4px 0 0 var(--error); }
    .fila { display: flex; justify-content: space-between; gap: var(--e2); align-items: baseline; }
    .quien { overflow-wrap: anywhere; }
    em { font-style: normal; font-size: var(--t-1); font-weight: 700; white-space: nowrap; color: var(--tinta-suave); }
    em[data-estado='PENDIENTE'] { color: var(--ambar); }
    em[data-estado='CONFIRMADA'] { color: var(--ok); }
    em[data-estado='CANCELADA'], em[data-estado='EXPIRADA'] { color: var(--error); }
    .numeros { display: flex; flex-wrap: wrap; gap: var(--e2); }
    .num { min-width: 3rem; padding: var(--e2) var(--e2); text-align: center; font: 700 var(--t0) var(--fuente-titulo); font-variant-numeric: tabular-nums; border-radius: var(--radio); background: var(--papel); border: 1px solid var(--linea); }
    .datos { display: grid; gap: var(--e1); font-size: var(--t-1); color: var(--tinta-suave); }
    .datos > span:first-child { color: var(--tinta); font-weight: 700; font-size: var(--t0); }
    .vence { font-weight: 600; color: var(--ambar); }
    .vence.rojo { color: var(--error); }
    .contacto { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e2); }
    .contacto a { display: grid; place-items: center; min-height: 3rem; border-radius: var(--radio); border: 2px solid var(--linea); color: var(--tinta); text-decoration: none; font-weight: 600; }
    .contacto a:only-child { grid-column: 1 / -1; }
    .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e2); }
    .panel { display: grid; gap: var(--e3); padding: var(--e3); background: var(--papel); border-radius: var(--radio); }
    .ayuda { margin: 0; color: var(--tinta-suave); font-size: var(--t-1); }
    .campo { display: grid; gap: var(--e1); font-weight: 600; font-size: var(--t-1); }
    .vacio { text-align: center; color: var(--tinta-suave); padding-block: var(--e5); }
    .mas { width: 100%; min-height: 3.5rem; }
    @media (min-width: 48rem) {
      .buscar { max-width: 32rem; }
      .compra { grid-template-columns: 1fr 1fr; align-items: start; }
      .fila, .numeros, .acciones, .panel { grid-column: 1 / -1; }
      .acciones { max-width: 28rem; }
    }
  `,
})
export class AdminPagos {
  private readonly api = inject(AdminApi);

  readonly filtros = FILTROS;
  readonly metodos = METODOS_PAGO;

  texto = '';
  observacion = '';
  motivo = '';

  readonly estado = signal<EstadoCompra | null>('PENDIENTE');
  readonly items = signal<CompraAdmin[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly totalPaginas = signal(0);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorBusqueda = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly abierta = signal<Accion | null>(null);
  readonly metodo = signal<string>('');
  readonly enviando = signal<string | null>(null);
  /** Reloj para las cuentas regresivas (se refresca cada 30 s). */
  private readonly ahora = signal(Date.now());
  private readonly cifrasPorRifa = signal<Record<string, number | undefined>>({});
  private filtro: Pick<FiltroCompras, 'telefono' | 'numero'> = {};
  private peticion = 0;

  readonly hayMas = computed(() => this.pagina() + 1 < this.totalPaginas());
  readonly resumen = computed(() => {
    const t = this.total();
    return t === 0 ? '' : `${t} ${t === 1 ? 'reserva' : 'reservas'}`;
  });

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    // Las cifras de cada rifa (07 / 007 / 0007) viven en la rifa, no en la compra.
    this.api.misRifas(0, 100).subscribe({
      next: (p) => this.cifrasPorRifa.set(Object.fromEntries(p.contenido.map((r) => [r.codigo, r.digitos ?? undefined]))),
      error: () => undefined, // sin cifras se muestran los números tal cual; no bloquea la cola
    });
    this.cargar(true);
  }

  elegir(e: EstadoCompra | null): void {
    this.estado.set(e);
    this.aviso.set(null);
    this.cargar(true);
  }

  buscar(ev: Event): void {
    ev.preventDefault();
    const b = interpretarBusqueda(this.texto);
    this.errorBusqueda.set(null);
    if (b.tipo === 'invalida') { this.errorBusqueda.set(b.mensaje); return; }
    this.filtro = b.tipo === 'telefono' ? { telefono: b.telefono } : b.tipo === 'numero' ? { numero: b.numero } : {};
    // Buscar un número o un celular suele ser para ver "qué pasó con esa persona": se mira en todos los estados.
    if (b.tipo !== 'vacia') this.estado.set(null);
    this.aviso.set(null);
    this.cargar(true);
  }

  cargar(reiniciar: boolean): void {
    const mia = ++this.peticion;
    const pagina = reiniciar ? 0 : this.pagina() + 1;
    this.cargando.set(true);
    this.error.set(null);
    this.api.compras({ ...this.filtro, estado: this.estado() ?? undefined, pagina }).subscribe({
      next: (p) => {
        if (mia !== this.peticion) return; // llegó una respuesta vieja: se ignora
        this.items.update((l) => (reiniciar ? p.contenido : [...l, ...p.contenido]));
        this.total.set(p.totalElementos);
        this.pagina.set(p.pagina);
        this.totalPaginas.set(p.totalPaginas);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        if (mia !== this.peticion) return;
        this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la cola de pagos.');
        this.cargando.set(false);
      },
    });
  }

  masPaginas(): void {
    this.cargar(false);
  }

  abrir(c: CompraAdmin, modo: Accion['modo']): void {
    this.abierta.set({ codigo: c.codigo, modo });
    this.metodo.set('');
    this.observacion = '';
    this.motivo = '';
    this.aviso.set(null);
  }

  cerrar(): void {
    this.abierta.set(null);
  }

  confirmar(c: CompraAdmin): void {
    if (!this.metodo() || this.enviando()) return;
    this.enviando.set(c.codigo);
    this.error.set(null);
    this.api.confirmarPago(c.codigo, { metodo: this.metodo(), observacion: this.observacion.trim() || undefined }).subscribe({
      next: () => {
        this.terminar(`Pago confirmado: ${this.lista(c)} quedaron vendidos.`);
      },
      error: (e: unknown) => this.fallar(e, 'No se pudo confirmar el pago.'),
    });
  }

  liberar(c: CompraAdmin): void {
    if (this.enviando()) return;
    this.enviando.set(c.codigo);
    this.error.set(null);
    this.api.liberar(c.codigo, this.motivo.trim() || undefined).subscribe({
      next: (r) => {
        this.terminar(`Reserva liberada: ${r.boletosLiberados} ${r.boletosLiberados === 1 ? 'número vuelve' : 'números vuelven'} a la venta.`);
      },
      error: (e: unknown) => this.fallar(e, 'No se pudo liberar la reserva.'),
    });
  }

  /** Tras actuar se vuelve a pedir la lista: el servidor manda (otra persona pudo cambiar algo). */
  private terminar(mensaje: string): void {
    this.enviando.set(null);
    this.abierta.set(null);
    this.aviso.set(mensaje);
    this.cargar(true);
  }

  private fallar(e: unknown, defecto: string): void {
    this.enviando.set(null);
    this.error.set(e instanceof Error ? e.message : defecto);
    // 409: alguien ya la cambió (o el job la venció). Se recarga para mostrar la verdad.
    this.cargar(true);
  }

  num(c: CompraAdmin, n: number): string {
    return formatearNumero(n, c.codigoRifa ? this.cifrasPorRifa()[c.codigoRifa] : undefined);
  }

  private lista(c: CompraAdmin): string {
    return c.numeros.map((n) => this.num(c, n)).join(', ');
  }

  minutosRestantes(c: CompraAdmin): number {
    return Math.floor((new Date(c.expiraEn).getTime() - this.ahora()) / 60_000);
  }

  vence(c: CompraAdmin): string {
    const m = this.minutosRestantes(c);
    if (m < 0) return 'Venció: se libera en breve';
    if (m < 1) return 'Vence en menos de 1 min';
    if (m < 60) return `Vence en ${m} min`;
    const h = Math.floor(m / 60);
    return `Vence en ${h} h ${m % 60} min`;
  }

  etiqueta(e: EstadoCompra): string {
    return { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', EXPIRADA: 'Vencida', CANCELADA: 'Liberada' }[e];
  }

  plata = (c: CompraAdmin) => formatearMoneda(c.subtotal, c.moneda ?? 'COP');
  fecha = formatearFechaHoraCorta;
  telefono = (c: CompraAdmin) => telefonoParaMostrar(c.compradorTelefono);
  wa = (c: CompraAdmin) => enlaceWhatsapp(c.compradorTelefono, `Hola ${c.compradorNombre ?? ''}, te escribo por tu reserva ${c.codigo}.`.replace('  ', ' '));
}
