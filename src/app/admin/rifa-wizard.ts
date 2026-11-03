import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { concat, defaultIfEmpty, last, of, switchMap, tap } from 'rxjs';
import { AdminApi } from '../core/api/admin-api';
import { ApiError } from '../core/api/api-error';
import { Loteria, MetodoSorteo, ReglaVacante, RifaGestion } from '../core/api/models';
import { formatearEntero, formatearFechaHoraCorta, formatearMoneda } from '../core/formato';
import {
  BORRADOR_VACIO, Borrador, Errores, aInstante, aPremiosRequest, aRifaRequest, numeroDe,
  validarDatos, validarPremios, validarSorteo, validarTodo,
} from './rifa-borrador';

const PASOS = ['Datos', 'Premios', 'Sorteo', 'Publicar'] as const;

/**
 * Wizard de rifa (CP-17): datos -> premios -> lotería -> publicar. Pensado para el celular: un paso por pantalla,
 * campos de 16 px, teclado numérico y barra de acciones fija junto al pulgar.
 * La API crea la rifa con su configuración de sorteo de una vez, así que todo se junta aquí y se envía al final
 * (crear -> premios -> publicar). Si algo falla a mitad, la rifa queda en borrador y "Reintentar" continúa donde quedó.
 */
@Component({
  selector: 'app-rifa-wizard',
  imports: [RouterLink],
  template: `
    @if (lista(); as r) {
      <section class="exito" aria-live="polite">
        <p class="sello">{{ r.estado === 'PUBLICADA' ? '¡Publicada!' : 'Borrador guardado' }}</p>
        <h1>{{ r.titulo }}</h1>
        <p>
          @if (r.estado === 'PUBLICADA') { Ya se pueden reservar números en <strong>/rifa/{{ r.codigo }}</strong>. }
          @else { Quedó en borrador. Puedes publicarla cuando quieras desde "Rifas". }
        </p>
        <div class="acciones-fin">
          @if (r.estado === 'PUBLICADA') { <a class="boton" [routerLink]="['/rifa', r.codigo]">Ver la rifa</a> }
          <a class="boton boton--secundario" routerLink="/admin/rifas">Ir a mis rifas</a>
        </div>
      </section>
    } @else {
      <header class="cab">
        <p class="paso-texto">Paso {{ paso() + 1 }} de 4 · <strong>{{ pasos[paso()] }}</strong></p>
        <div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="4" [attr.aria-valuenow]="paso() + 1"><span [style.width.%]="(paso() + 1) * 25"></span></div>
      </header>

      @if (creada(); as c) {
        <p class="aviso" role="status">La rifa «{{ c.titulo }}» ya se creó en borrador. Solo falta terminar de enviarla.</p>
      }

      @switch (paso()) {
        @case (0) {
          <h1>Datos de la rifa</h1>
          <div class="campo" [class.mal]="err()['titulo']">
            <label for="titulo">Título</label>
            <input id="titulo" type="text" maxlength="120" autocomplete="off" [value]="b().titulo" (input)="poner('titulo', $event)" />
            @if (err()['titulo']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <div class="campo" [class.mal]="err()['descripcion']">
            <label for="desc">Descripción <span class="opc">(opcional)</span></label>
            <textarea id="desc" rows="3" [value]="b().descripcion" (input)="poner('descripcion', $event)"></textarea>
          </div>
          <div class="campo" [class.mal]="err()['imagenUrl']">
            <label for="img">Enlace de la imagen <span class="opc">(opcional, https)</span></label>
            <input id="img" type="url" inputmode="url" autocapitalize="none" [value]="b().imagenUrl" (input)="poner('imagenUrl', $event)" />
            @if (err()['imagenUrl']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <div class="campo" [class.mal]="err()['precio']">
            <label for="precio">Precio por boleto (COP)</label>
            <input id="precio" type="text" inputmode="numeric" placeholder="5.000" [value]="b().precio" (input)="poner('precio', $event)" />
            @if (err()['precio']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <div class="campo" [class.mal]="err()['cantidad']">
            <label for="cant">Cantidad de boletos</label>
            <div class="fichas" role="group" aria-label="Cantidades comunes">
              @for (n of [100, 1000, 10000]; track n) {
                <button type="button" class="ficha" [class.activa]="b().cantidad === '' + n" (click)="fijar('cantidad', '' + n)">{{ fmt(n) }}</button>
              }
            </div>
            <input id="cant" type="text" inputmode="numeric" [value]="b().cantidad" (input)="poner('cantidad', $event)" />
            @if (err()['cantidad']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <div class="fila">
            <div class="campo" [class.mal]="err()['maxPorCompra']">
              <label for="max">Máx. por compra</label>
              <input id="max" type="text" inputmode="numeric" [value]="b().maxPorCompra" (input)="poner('maxPorCompra', $event)" />
              @if (err()['maxPorCompra']; as m) { <small role="alert">{{ m }}</small> }
            </div>
            <div class="campo" [class.mal]="err()['reservaMinutos']">
              <label for="res">Reserva (min)</label>
              <input id="res" type="text" inputmode="numeric" [value]="b().reservaMinutos" (input)="poner('reservaMinutos', $event)" />
              @if (err()['reservaMinutos']; as m) { <small role="alert">{{ m }}</small> }
            </div>
          </div>
          <p class="ayuda">La reserva es el tiempo que tiene el comprador para pagar antes de que el número vuelva a quedar libre.</p>
          <div class="campo" [class.mal]="err()['cierreVentas']">
            <label for="cierre">Cierre de ventas</label>
            <input id="cierre" type="datetime-local" [value]="b().cierreVentas" (input)="poner('cierreVentas', $event)" />
            @if (err()['cierreVentas']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <div class="campo" [class.mal]="err()['fechaSorteo']">
            <label for="sorteo">Fecha y hora del sorteo</label>
            <input id="sorteo" type="datetime-local" [value]="b().fechaSorteo" (input)="poner('fechaSorteo', $event)" />
            @if (err()['fechaSorteo']; as m) { <small role="alert">{{ m }}</small> }
          </div>
          <p class="ayuda">Las horas son de Colombia.</p>
        }
        @case (1) {
          <h1>Premios</h1>
          <p class="ayuda">El primero es el premio mayor. Necesitas al menos uno para publicar.</p>
          @if (err()['premios']; as m) { <p class="error" role="alert">{{ m }}</p> }
          @for (p of b().premios; track $index; let i = $index) {
            <fieldset class="premio" [class.mal]="err()['premio' + i]">
              <legend>Premio {{ i + 1 }}</legend>
              <div class="campo">
                <label [for]="'pn' + i">Nombre</label>
                <input [id]="'pn' + i" type="text" maxlength="120" [value]="p.nombre" (input)="premio(i, 'nombre', $event)" />
              </div>
              <div class="campo">
                <label [for]="'pv' + i">Valor estimado (COP) <span class="opc">(opcional)</span></label>
                <input [id]="'pv' + i" type="text" inputmode="numeric" [value]="p.valor" (input)="premio(i, 'valor', $event)" />
              </div>
              @if (err()['premio' + i]; as m) { <small class="msg" role="alert">{{ m }}</small> }
              @if (b().premios.length > 1) { <button type="button" class="texto" (click)="quitarPremio(i)">Quitar premio {{ i + 1 }}</button> }
            </fieldset>
          }
          @if (b().premios.length < 10) { <button type="button" class="boton boton--secundario ancho" (click)="agregarPremio()">+ Agregar otro premio</button> }
        }
        @case (2) {
          <h1>¿Cómo se sortea?</h1>
          <div class="opciones" role="radiogroup" aria-label="Método de sorteo">
            @for (m of metodos; track m.valor) {
              <button type="button" role="radio" class="opcion" [class.activa]="b().metodo === m.valor" [attr.aria-checked]="b().metodo === m.valor" (click)="metodo(m.valor)">
                <strong>{{ m.titulo }}</strong><span>{{ m.texto }}</span>
              </button>
            }
          </div>
          @if (b().metodo === 'LOTERIA') {
            <div class="campo" [class.mal]="err()['loteria']">
              <label for="lot">Lotería</label>
              <select id="lot" [value]="b().loteriaId ?? ''" (change)="loteria($event)">
                <option value="">Elige una…</option>
                @for (l of loterias(); track l.id) { <option [value]="l.id" [selected]="b().loteriaId === l.id">{{ l.nombre }}</option> }
              </select>
              @if (cargandoLoterias()) { <small>Cargando loterías…</small> }
              @else if (loterias().length === 0) { <small role="alert">No hay loterías activas. Pídele al administrador que las cargue, o elige otro método.</small> }
              @if (err()['loteria']; as m) { <small role="alert">{{ m }}</small> }
            </div>
            <div class="campo" [class.mal]="err()['digitos']">
              <span class="etq">Cifras que cuentan del número ganador</span>
              <div class="fichas" role="radiogroup" aria-label="Cifras">
                @for (d of [2, 3, 4]; track d) {
                  <button type="button" role="radio" class="ficha" [class.activa]="b().digitos === d" [attr.aria-checked]="b().digitos === d" (click)="digitos(d)">{{ d }} cifras · {{ fmt(10 ** d) }}</button>
                }
              </div>
              <small>Gana el boleto cuyos números coinciden con las últimas {{ b().digitos }} cifras del premio mayor. La rifa tendrá {{ fmt(10 ** b().digitos) }} boletos (del {{ ceros(0) }} al {{ ceros(10 ** b().digitos - 1) }}).</small>
              @if (err()['digitos']; as m) { <small role="alert">{{ m }}</small> }
            </div>
            <div class="campo">
              <span class="etq">Si el número ganador no se vendió</span>
              <div class="opciones" role="radiogroup" aria-label="Regla de cupo vacío">
                @for (r of reglas; track r.valor) {
                  <button type="button" role="radio" class="opcion" [class.activa]="b().reglaVacante === r.valor" [attr.aria-checked]="b().reglaVacante === r.valor" (click)="regla(r.valor)">
                    <strong>{{ r.titulo }}</strong><span>{{ r.texto }}</span>
                  </button>
                }
              </div>
              <small>Los compradores verán esta regla antes de reservar.</small>
            </div>
          }
          <div class="campo">
            <label for="aut">N.º de autorización <span class="opc">(opcional)</span></label>
            <input id="aut" type="text" maxlength="60" [value]="b().numeroAutorizacion" (input)="poner('numeroAutorizacion', $event)" />
          </div>
          <div class="campo">
            <label for="ent">Entidad que autoriza <span class="opc">(opcional)</span></label>
            <input id="ent" type="text" maxlength="120" [value]="b().entidadAutorizadora" (input)="poner('entidadAutorizadora', $event)" />
          </div>
        }
        @default {
          <h1>Revisa y publica</h1>
          <dl class="resumen">
            <div><dt>Título</dt><dd>{{ b().titulo }}</dd></div>
            <div><dt>Boletos</dt><dd>{{ fmt(num(b().cantidad)) }} a {{ plata(num(b().precio)) }}</dd></div>
            <div><dt>Recaudo máximo</dt><dd>{{ plata(num(b().cantidad) * num(b().precio)) }}</dd></div>
            <div><dt>Cierre de ventas</dt><dd>{{ fecha(b().cierreVentas) }}</dd></div>
            <div><dt>Sorteo</dt><dd>{{ fecha(b().fechaSorteo) }}</dd></div>
            <div><dt>Método</dt><dd>{{ resumenMetodo() }}</dd></div>
            <div><dt>Premios</dt><dd>{{ premiosOk().length }}: {{ nombresPremios() }}</dd></div>
          </dl>
          <p class="ayuda">Al publicar, la rifa aparece en el inicio y se pueden reservar números. Si prefieres revisarla con calma, guárdala como borrador.</p>
          @if (errorGlobal(); as m) { <p class="error" role="alert">{{ m }}</p> }
        }
      }

      <div class="barra-acciones">
        @if (paso() > 0 && !creada()) { <button type="button" class="boton boton--secundario" (click)="atras()" [disabled]="enviando()">Atrás</button> }
        @if (paso() < 3) {
          <button type="button" class="boton principal" (click)="siguiente()">Siguiente</button>
        } @else {
          <button type="button" class="boton boton--secundario" (click)="enviar(false)" [disabled]="enviando()">Borrador</button>
          <button type="button" class="boton principal" (click)="enviar(true)" [disabled]="enviando()">{{ enviando() ? 'Enviando…' : creada() ? 'Reintentar y publicar' : 'Publicar rifa' }}</button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; padding-bottom: 7rem; }
    h1 { font-size: var(--t1); margin-bottom: var(--e3); }
    .cab { margin-bottom: var(--e3); }
    .paso-texto { margin: 0 0 var(--e2); color: var(--tinta-suave); }
    .barra { height: 0.5rem; background: var(--linea); border-radius: 1rem; overflow: hidden; }
    .barra span { display: block; height: 100%; background: var(--sol); border-radius: 1rem; transition: width 0.2s; }
    .campo { display: grid; gap: var(--e1); margin-bottom: var(--e3); }
    label, .etq { font-weight: 600; }
    .opc { font-weight: 400; color: var(--tinta-suave); }
    input, textarea, select { width: 100%; min-height: 3rem; padding: 0.6rem var(--e3); font: inherit; font-size: 1rem; /* 16 px: iOS no hace zoom */
      color: var(--tinta); background: var(--superficie); border: 2px solid var(--linea); border-radius: var(--radio); }
    textarea { resize: vertical; }
    .mal input, .mal select, fieldset.mal { border-color: var(--error); }
    small { color: var(--tinta-suave); font-size: var(--t-1); }
    .mal small, .msg, .error { color: var(--error); font-weight: 600; }
    .ayuda { color: var(--tinta-suave); font-size: var(--t-1); margin-top: calc(-1 * var(--e2)); }
    .aviso { background: var(--superficie); border: 1px solid var(--linea); border-left: 4px solid var(--sol); border-radius: var(--radio); padding: var(--e2) var(--e3); }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: var(--e3); }
    .fichas { display: flex; flex-wrap: wrap; gap: var(--e2); }
    .ficha { min-height: 2.75rem; padding: 0 var(--e3); border: 2px solid var(--linea); border-radius: 2rem; background: var(--superficie); color: var(--tinta); font: 600 var(--t-1) var(--fuente-texto); cursor: pointer; }
    .ficha.activa, .opcion.activa { border-color: var(--accion); box-shadow: inset 0 0 0 1px var(--accion); }
    .opciones { display: grid; gap: var(--e2); margin-bottom: var(--e3); }
    .opcion { display: grid; gap: 2px; text-align: left; min-height: 3.5rem; padding: var(--e2) var(--e3); border: 2px solid var(--linea); border-radius: var(--radio); background: var(--superficie); color: var(--tinta); font: inherit; cursor: pointer; }
    .opcion span { color: var(--tinta-suave); font-size: var(--t-1); }
    .premio { border: 2px solid var(--linea); border-radius: var(--radio); padding: var(--e3); margin: 0 0 var(--e3); background: var(--superficie); }
    .premio legend { font-weight: 700; padding: 0 var(--e2); }
    .texto { min-height: 2.75rem; background: none; border: 0; color: var(--error); font: 600 var(--t-1) var(--fuente-texto); cursor: pointer; padding: 0; }
    .ancho { width: 100%; }
    .resumen { display: grid; gap: 1px; background: var(--linea); border: 1px solid var(--linea); border-radius: var(--radio); overflow: hidden; margin: 0 0 var(--e3); }
    .resumen div { display: grid; grid-template-columns: 7.5rem 1fr; gap: var(--e2); background: var(--superficie); padding: var(--e2) var(--e3); }
    .resumen dt { color: var(--tinta-suave); } .resumen dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
    .barra-acciones { position: fixed; inset: auto 0 calc(3.5rem + env(safe-area-inset-bottom)) 0; z-index: 4; display: flex; gap: var(--e2);
      padding: var(--e2) var(--gutter); background: var(--superficie); border-top: 1px solid var(--linea); }
    .barra-acciones .boton { flex: 0 0 auto; min-height: 3.25rem; }
    .barra-acciones .principal { flex: 1; }
    .boton[disabled] { opacity: 0.6; cursor: progress; }
    .exito { text-align: center; padding-block: var(--e5); }
    .sello { display: inline-block; background: var(--sol); color: var(--sol-texto); font-weight: 700; padding: 0.25rem 1rem; border-radius: 2rem; }
    .acciones-fin { display: grid; gap: var(--e2); max-width: 20rem; margin: var(--e4) auto 0; }
    @media (min-width: 48rem) {
      :host { max-width: 40rem; margin-inline: auto; padding-bottom: 2rem; }
      .barra-acciones { position: sticky; inset: auto 0 0 0; border: 1px solid var(--linea); border-radius: var(--radio); margin-top: var(--e4); }
    }
  `,
})
export class RifaWizard {
  private readonly api = inject(AdminApi);

  readonly pasos = PASOS;
  readonly metodos: { valor: MetodoSorteo; titulo: string; texto: string }[] = [
    { valor: 'LOTERIA', titulo: 'Con una lotería', texto: 'Gana el número que salga en una lotería. Es lo más transparente.' },
    { valor: 'ALEATORIO', titulo: 'Al azar', texto: 'El sistema elige un boleto vendido al azar.' },
    { valor: 'MANUAL', titulo: 'Manual', texto: 'Tú escribes el número ganador al sortear.' },
  ];
  readonly reglas: { valor: ReglaVacante; titulo: string; texto: string }[] = [
    { valor: 'REPETIR_SIGUIENTE_LOTERIA', titulo: 'Repetir con la siguiente lotería', texto: 'Se espera el próximo resultado hasta que caiga en un número vendido.' },
    { valor: 'ADJUDICAR_SIGUIENTE_VENDIDO', titulo: 'Adjudicar al siguiente vendido', texto: 'Gana el siguiente número que sí se haya vendido.' },
  ];

  readonly paso = signal(0);
  readonly b = signal<Borrador>({ ...BORRADOR_VACIO, premios: [{ nombre: '', descripcion: '', valor: '' }] });
  readonly err = signal<Errores>({});
  readonly loterias = signal<Loteria[]>([]);
  readonly cargandoLoterias = signal(true);
  readonly enviando = signal(false);
  readonly errorGlobal = signal<string | null>(null);
  readonly creada = signal<RifaGestion | null>(null);
  readonly lista = signal<RifaGestion | null>(null);
  private premiosEnviados = 0;

  readonly premiosOk = computed(() => aPremiosRequest(this.b()));
  readonly nombresPremios = computed(() => this.premiosOk().map((p) => p.nombre).join(', '));

  constructor() {
    this.api.loteriasActivas().subscribe({
      next: (l) => { this.loterias.set(l); this.cargandoLoterias.set(false); },
      error: () => this.cargandoLoterias.set(false),
    });
  }

  fmt = formatearEntero;
  plata = (n: number) => formatearMoneda(Number.isFinite(n) ? n : 0);
  num = numeroDe;
  fecha = (local: string) => { const i = aInstante(local); return i ? formatearFechaHoraCorta(i) : '—'; };
  ceros = (n: number) => String(n).padStart(this.b().digitos, '0');

  resumenMetodo(): string {
    const b = this.b();
    if (b.metodo !== 'LOTERIA') return b.metodo === 'ALEATORIO' ? 'Al azar' : 'Manual';
    const l = this.loterias().find((x) => x.id === b.loteriaId);
    return `${l?.nombre ?? 'Lotería'} · últimas ${b.digitos} cifras`;
  }

  fijar<K extends keyof Borrador>(campo: K, valor: Borrador[K]): void {
    this.b.update((x) => ({ ...x, [campo]: valor }));
    this.err.update((e) => { const { [campo as string]: _quitar, ...resto } = e; return resto; });
  }
  poner(campo: keyof Borrador, ev: Event): void {
    this.fijar(campo, (ev.target as HTMLInputElement).value as never);
  }
  premio(i: number, campo: 'nombre' | 'valor', ev: Event): void {
    const valor = (ev.target as HTMLInputElement).value;
    this.b.update((x) => ({ ...x, premios: x.premios.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)) }));
    this.err.set({});
  }
  agregarPremio(): void {
    this.b.update((x) => ({ ...x, premios: [...x.premios, { nombre: '', descripcion: '', valor: '' }] }));
  }
  quitarPremio(i: number): void {
    this.b.update((x) => ({ ...x, premios: x.premios.filter((_, j) => j !== i) }));
  }
  metodo(m: MetodoSorteo): void {
    this.fijar('metodo', m);
    if (m === 'LOTERIA') this.fijar('cantidad', String(10 ** this.b().digitos));
  }
  digitos(d: number): void {
    this.fijar('digitos', d as 2 | 3 | 4);
    this.fijar('cantidad', String(10 ** d));
    this.fijar('maxPorCompra', String(Math.min(numeroDe(this.b().maxPorCompra) || 10, 10 ** d)));
  }
  regla(r: ReglaVacante): void { this.fijar('reglaVacante', r); }
  loteria(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.fijar('loteriaId', v ? Number(v) : null);
  }

  private validarPaso(p: number): Errores {
    return p === 0 ? validarDatos(this.b()) : p === 1 ? validarPremios(this.b()) : p === 2 ? validarSorteo(this.b()) : {};
  }

  siguiente(): void {
    const e = this.validarPaso(this.paso());
    this.err.set(e);
    if (Object.keys(e).length > 0) { this.enfocarError(); return; }
    this.irA(this.paso() + 1);
  }
  atras(): void { this.irA(Math.max(0, this.paso() - 1)); }

  private irA(p: number): void {
    this.paso.set(p);
    this.err.set({});
    this.errorGlobal.set(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  private enfocarError(): void {
    setTimeout(() => (document.querySelector('.mal input, .mal select, .mal textarea, .error') as HTMLElement | null)?.focus?.());
  }

  enviar(publicar: boolean): void {
    if (this.enviando()) return;
    const todos = validarTodo(this.b());
    if (publicar ? Object.keys(todos).length > 0 : Object.keys({ ...validarDatos(this.b()), ...validarSorteo(this.b()) }).length > 0) {
      const primero = ['titulo', 'precio', 'cantidad', 'maxPorCompra', 'reservaMinutos', 'cierreVentas', 'fechaSorteo'].some((k) => todos[k]) ? 0
        : Object.keys(todos).some((k) => k.startsWith('premio')) ? 1 : 2;
      this.irA(primero);
      this.err.set(todos);
      this.enfocarError();
      return;
    }
    this.errorGlobal.set(null);
    this.enviando.set(true);
    const premios = aPremiosRequest(this.b());
    const crear$ = this.creada() ? of(this.creada()!) : this.api.crearRifa(aRifaRequest(this.b())).pipe(tap((r) => this.creada.set(r)));
    crear$.pipe(
      switchMap((r) => {
        const pend = premios.slice(this.premiosEnviados).map((p) => this.api.agregarPremio(r.id, p).pipe(tap(() => this.premiosEnviados++)));
        return concat(...pend).pipe(last(null, null), defaultIfEmpty(null), switchMap(() => (publicar ? this.api.publicar(r.id) : of(r))));
      }),
    ).subscribe({
      next: (r) => { this.enviando.set(false); this.lista.set(r); },
      error: (e: unknown) => {
        this.enviando.set(false);
        const base = e instanceof ApiError ? e.message : 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.';
        this.errorGlobal.set(this.creada() ? `${base} La rifa quedó guardada como borrador; pulsa «Reintentar» para continuar.` : base);
      },
    });
  }
}
