import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, exhaustMap, filter, fromEvent, map, merge, of, switchMap, timer } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { EstadoCompra, Reserva as ReservaDto, RifaDetalle } from '../core/api/models';
import { formatearNumero } from '../core/boletos';
import { CONFIG_PAGO, enlaceWhatsapp } from '../core/config-pago';
import { formatearCuentaRegresiva } from '../core/cuenta-regresiva';
import { formatearFechaHora, formatearMoneda } from '../core/formato';
import { guardarTelefono, telefonoGuardado } from '../core/reservas-locales';
import { normalizarTelefono } from '../core/telefono';
import { AvisoCarga } from '../shared/aviso-carga';

/** Cada cuánto se pregunta si el organizador ya confirmó el pago (solo con la pestaña visible). */
export const INTERVALO_RESERVA_MS = 15_000;

const ETIQUETAS: Record<EstadoCompra, string> = {
  PENDIENTE: 'Pendiente de pago',
  CONFIRMADA: 'Pago confirmado',
  EXPIRADA: 'Reserva vencida',
  CANCELADA: 'Reserva liberada',
};

/**
 * Estado de la reserva (/reserva/:codigo). La API pide código + teléfono: el teléfono se recuerda en este
 * navegador al reservar; si falta (enlace compartido, otro dispositivo) se pide aquí.
 */
@Component({
  selector: 'app-reserva',
  imports: [RouterLink, AvisoCarga],
  template: `
    <section class="contenedor">
      <h1>Tu reserva</h1>

      @if (pedirTelefono()) {
        <form class="pedir" novalidate (submit)="buscar($event)" aria-labelledby="t-pedir">
          <h2 id="t-pedir">Escribe el celular con el que reservaste</h2>
          <p class="ayuda">Por seguridad, solo quien conoce el código y el celular puede ver una reserva.</p>
          <label for="telefono">Celular</label>
          <input id="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="300 123 4567"
                 [value]="telefonoCampo()" (input)="telefonoCampo.set($any($event.target).value)"
                 [attr.aria-invalid]="errorTelefono() ? 'true' : null" [attr.aria-describedby]="errorTelefono() ? 'e-tel' : null" />
          @if (errorTelefono(); as e) { <p id="e-tel" class="error" role="alert">{{ e }}</p> }
          <button class="boton" type="submit">Buscar mi reserva</button>
        </form>
      }

      <app-aviso-carga [cargando]="cargando()" [error]="error()" (reintentar)="cargar()">
        @if (reserva(); as r) {
          <p class="estado" [class]="'estado ' + r.estado" role="status">{{ etiqueta() }}</p>

          @switch (r.estado) {
            @case ('PENDIENTE') {
              @if (vencida()) {
                <p class="vencida" role="alert">
                  El tiempo para pagar terminó. Si ya pagaste, avisa al organizador cuanto antes; si no, los números
                  pueden volver a quedar libres en cualquier momento.
                </p>
              } @else {
                <div class="reloj" role="timer" aria-label="Tiempo restante para pagar">
                  <span class="cifras">{{ restante() }}</span>
                  <span class="leyenda">para pagar antes de que se liberen tus números</span>
                </div>
                @if (r.expiraEn) { <p class="ayuda">Vence el {{ fecha(r.expiraEn) }}</p> }
              }
            }
            @case ('CONFIRMADA') { <p class="lead">¡Listo! El organizador confirmó tu pago. Tus números ya son tuyos.</p> }
            @case ('EXPIRADA') { <p class="lead">No se confirmó el pago a tiempo y los números se liberaron.</p> }
            @case ('CANCELADA') { <p class="lead">El organizador liberó esta reserva.</p> }
          }

          <div class="boleto">
            <div class="talon">
              <span class="titulo-talon">{{ rifa()?.titulo ?? 'Tu rifa' }}</span>
              <ul class="numeros" aria-label="Tus números">
                @for (n of r.numeros; track n) { <li>{{ texto(n) }}</li> }
              </ul>
            </div>
            <dl>
              <dt>A nombre de</dt><dd>{{ r.compradorNombre }}</dd>
              <dt>Celular</dt><dd>{{ r.telefonoEnmascarado }}</dd>
              <dt>Total</dt><dd class="total">{{ moneda(r.subtotal) }}</dd>
              <dt>Código</dt>
              <dd><code>{{ r.codigo }}</code></dd>
            </dl>
            <div class="copiar">
              <button type="button" class="boton boton--secundario" (click)="copiar(r.codigo, 'código')">Copiar código</button>
              <button type="button" class="boton boton--secundario" (click)="copiar(enlace(), 'enlace')">Copiar enlace</button>
              <span class="solo-lectores" role="status">{{ copiado() }}</span>
              @if (copiado()) { <span class="copiado" aria-hidden="true">{{ copiado() }}</span> }
            </div>
          </div>

          @if (r.estado === 'PENDIENTE' && !vencida()) {
            <h2>Cómo pagar</h2>
            <ol class="pasos">
              <li>Paga <strong>{{ moneda(r.subtotal) }}</strong> (el valor exacto de tu reserva).</li>
              <li>Envía el comprobante al organizador indicando tu <strong>código de reserva</strong>.</li>
              <li>Cuando el organizador lo confirme, esta pantalla cambia sola a “Pago confirmado”.</li>
            </ol>
            @if (whatsapp(); as enlaceWa) {
              <a class="boton" [href]="enlaceWa" target="_blank" rel="noopener">Escribir por WhatsApp</a>
            } @else {
              <p class="ayuda">El organizador te contactará al celular {{ r.telefonoEnmascarado }} para coordinar el pago.</p>
            }
          }

          <div class="salidas">
            @if (r.estado === 'EXPIRADA' || r.estado === 'CANCELADA' || vencida()) {
              <a class="boton" [routerLink]="['/rifa', r.codigoRifa]" fragment="numeros">Escoger números de nuevo</a>
            } @else {
              <a class="boton boton--secundario" [routerLink]="['/rifa', r.codigoRifa]">Ver la rifa</a>
            }
          </div>
        }
      </app-aviso-carga>
    </section>
  `,
  styles: `
    section { padding-block: var(--e5) var(--e6); }
    h2 { font-size: var(--t1); margin-top: var(--e5); }
    .ayuda { color: var(--tinta-suave); font-size: var(--t-1); }
    .error { color: var(--error); font-weight: 600; font-size: var(--t-1); }
    .lead { font-size: var(--t1); font-family: var(--fuente-titulo); max-width: 40ch; }

    .pedir { max-width: 28rem; padding: var(--e4); margin-bottom: var(--e4); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .pedir h2 { margin-top: 0; }
    .pedir label { display: block; font-weight: 600; margin-bottom: var(--e1); }
    .pedir input {
      width: 100%; min-height: 2.75rem; padding-inline: var(--e3); margin-bottom: var(--e3); border-radius: var(--radio);
      border: 1px solid var(--linea); background: var(--papel); color: var(--tinta); font: inherit;
    }
    .pedir input[aria-invalid='true'] { border: 2px solid var(--error); }

    .estado { display: inline-block; margin: 0 0 var(--e3); padding: 0.25rem var(--e3); border-radius: 999px; font-weight: 700; border: 2px solid currentColor; }
    .estado.PENDIENTE { color: var(--ambar); }
    .estado.CONFIRMADA { color: var(--ok); }
    .estado.EXPIRADA, .estado.CANCELADA { color: var(--tinta-suave); }

    .reloj { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--e2) var(--e3); margin-bottom: var(--e2); }
    .cifras { font: 800 var(--t3) var(--fuente-titulo); letter-spacing: -0.04em; color: var(--tinta); }
    .leyenda { color: var(--tinta-suave); }
    .vencida { padding: var(--e3); border-left: 4px solid var(--error); background: var(--superficie); max-width: 60ch; }

    .boleto { margin-block: var(--e4); max-width: 40rem; background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); overflow: hidden; }
    .talon { padding: var(--e4); background: var(--sol); color: var(--sol-texto); border-bottom: 2px dashed var(--tinta); }
    .titulo-talon { display: block; font-weight: 700; margin-bottom: var(--e2); }
    .numeros { display: flex; flex-wrap: wrap; gap: var(--e2); margin: 0; padding: 0; list-style: none; }
    .numeros li { font: 800 var(--t2) var(--fuente-titulo); letter-spacing: -0.03em; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: var(--e2) var(--e4); margin: 0; padding: var(--e4); }
    dt { color: var(--tinta-suave); }
    dd { margin: 0; font-weight: 600; min-width: 0; }
    dd.total { font: 800 var(--t1) var(--fuente-titulo); }
    code { font-size: var(--t-1); word-break: break-all; }
    .copiar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--e2); padding: 0 var(--e4) var(--e4); }
    .copiado { color: var(--ok); font-weight: 600; font-size: var(--t-1); }

    .pasos { max-width: 56ch; padding-left: var(--e4); }
    .pasos li { margin-bottom: var(--e2); }
    .salidas { margin-top: var(--e5); }
  `,
})
export class Reserva {
  private readonly api = inject(ApiService);
  private readonly titulo = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** Parámetro de ruta `:codigo` (withComponentInputBinding). */
  readonly codigo = input.required<string>();

  protected readonly reserva = signal<ReservaDto | null>(null);
  protected readonly rifa = signal<RifaDetalle | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  /** Teléfono (10 dígitos) con el que se consulta; sale del almacén local o del formulario. */
  private readonly telefono = signal<string | null>(null);
  protected readonly pedirTelefono = signal(false);
  protected readonly telefonoCampo = signal('');
  protected readonly errorTelefono = signal('');
  protected readonly copiado = signal('');
  private readonly ahora = signal(Date.now());

  protected readonly pendiente = computed(() => this.reserva()?.estado === 'PENDIENTE');
  private readonly msRestantes = computed(() => {
    const exp = this.reserva()?.expiraEn;
    return exp ? Date.parse(exp) - this.ahora() : Number.POSITIVE_INFINITY;
  });
  protected readonly vencida = computed(() => this.pendiente() && this.msRestantes() <= 0);
  protected readonly restante = computed(() => formatearCuentaRegresiva(this.msRestantes()));
  protected readonly etiqueta = computed(() => {
    const e = this.reserva()?.estado;
    return e ? ETIQUETAS[e] : '';
  });
  protected readonly whatsapp = computed(() => {
    const r = this.reserva();
    if (!r) return null;
    const numeros = r.numeros.map((n) => this.texto(n)).join(', ');
    const texto =
      `Hola, soy ${r.compradorNombre}. Reservé los números ${numeros} de «${this.rifa()?.titulo ?? r.codigoRifa}» ` +
      `por ${this.moneda(r.subtotal)}. Mi código de reserva es ${r.codigo}. Te envío el comprobante de pago.`;
    return enlaceWhatsapp(CONFIG_PAGO.whatsapp, texto);
  });

  constructor() {
    // Solo `codigo` dispara este efecto; el resto va en untracked para que cambiar el teléfono no lo reinicie.
    effect(() => {
      const codigo = this.codigo();
      untracked(() => {
        this.reserva.set(null);
        this.rifa.set(null);
        this.error.set(null);
        this.errorTelefono.set('');
        this.telefono.set(telefonoGuardado(codigo));
        this.pedirTelefono.set(!this.telefono());
        if (this.telefono()) this.cargar();
      });
    });

    // Reloj: un tic por segundo mientras la reserva esté pendiente (se detiene solo al cambiar de estado o salir).
    effect((limpiar) => {
      if (!this.pendiente()) return;
      this.ahora.set(Date.now());
      const id = setInterval(() => this.ahora.set(Date.now()), 1000);
      limpiar(() => clearInterval(id));
    });

    // Mientras esté pendiente, pregunta cada 15 s si ya se confirmó (o venció), sin consultar con la pestaña oculta.
    toObservable(this.pendiente).pipe(
      switchMap((viva) =>
        viva
          ? merge(timer(INTERVALO_RESERVA_MS, INTERVALO_RESERVA_MS), fromEvent(document, 'visibilitychange')).pipe(
              filter(() => !document.hidden),
              exhaustMap(() => this.consultar().pipe(catchError(() => EMPTY))),
            )
          : EMPTY,
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((r) => this.reserva.set(r));
  }

  protected moneda(v: number): string { return formatearMoneda(v, this.rifa()?.moneda); }
  protected texto(n: number): string { return formatearNumero(n, this.rifa()?.digitos); }
  protected fecha(iso: string): string { return formatearFechaHora(iso); }
  protected enlace(): string { return `${location.origin}/reserva/${this.codigo()}`; }

  protected cargar(): void {
    const codigo = this.codigo();
    if (!this.telefono()) return;
    this.cargando.set(true);
    this.error.set(null);
    this.consultar().pipe(
      // La rifa solo aporta título, moneda y ceros a la izquierda: si falla, la reserva se muestra igual.
      switchMap((r) => this.api.rifa(r.codigoRifa).pipe(catchError(() => of(null)), map((rifa) => ({ r, rifa })))),
    ).subscribe({
      next: ({ r, rifa }) => {
        if (codigo !== this.codigo()) return; // llegó tarde: ya se navegó a otra reserva
        this.rifa.set(rifa);
        this.reserva.set(r);
        this.titulo.setTitle(`Tu reserva · ${rifa?.titulo ?? 'Alex Rifas'}`);
        this.pedirTelefono.set(false);
        this.cargando.set(false);
        const tel = this.telefono();
        if (tel) guardarTelefono(codigo, tel); // se recuerda solo si la API lo aceptó
      },
      error: (e: ApiError) => {
        if (codigo !== this.codigo()) return;
        this.cargando.set(false);
        if (e.estado === 404) {
          // Código o teléfono no coinciden: se vuelve a pedir el teléfono en vez de mostrar un callejón sin salida.
          this.pedirTelefono.set(true);
          this.errorTelefono.set('No encontramos una reserva con ese código y ese celular. Revisa el número e inténtalo de nuevo.');
        } else {
          this.error.set(e);
        }
      },
    });
  }

  protected buscar(evento: Event): void {
    evento.preventDefault();
    const tel = normalizarTelefono(this.telefonoCampo());
    if (!tel) {
      this.errorTelefono.set('Escribe un celular colombiano válido de 10 dígitos (ej. 300 123 4567).');
      return;
    }
    this.errorTelefono.set('');
    this.telefono.set(tel);
    this.cargar();
  }

  protected async copiar(texto: string, que: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(`Se copió el ${que}.`);
    } catch {
      this.copiado.set(`No pudimos copiar el ${que}; selecciónalo y cópialo a mano.`);
    }
    setTimeout(() => this.copiado.set(''), 3000);
  }

  private consultar() {
    return this.api.consultarReserva(this.codigo(), this.telefono() ?? '');
  }
}
