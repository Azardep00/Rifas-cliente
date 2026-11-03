import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { RifaDetalle } from '../core/api/models';
import { formatearNumero } from '../core/boletos';
import { Carrito } from '../core/carrito';
import { formatearDuracion, formatearMoneda } from '../core/formato';
import { guardarTelefono } from '../core/reservas-locales';
import { limpiarNombre, normalizarTelefono } from '../core/telefono';
import { AvisoCarga } from '../shared/aviso-carga';

/**
 * Checkout de invitado (ADR-04): nombre + celular + los números del carrito. No hay cuenta ni pago en línea:
 * se crea una reserva PENDIENTE que vence en `reservaMinutos`, y el pago se confirma a mano (ver /reserva/:codigo).
 */
@Component({
  selector: 'app-reservar',
  imports: [RouterLink, AvisoCarga],
  template: `
    <section class="contenedor">
      <a class="volver" [routerLink]="['/rifa', codigo()]" fragment="numeros">Volver a la rifa</a>

      <app-aviso-carga [cargando]="cargando()" [error]="errorCarga()" (reintentar)="cargar()">
        @if (rifa(); as r) {
          <h1>Reserva tus números</h1>
          <p class="rifa-nombre">{{ r.titulo }}</p>

          @if (r.estado !== 'PUBLICADA') {
            <div class="vacio" role="status">
              <p>Esta rifa ya no recibe reservas.</p>
              <a class="boton boton--secundario" [routerLink]="['/rifa', r.codigo]">Ver la rifa</a>
            </div>
          } @else if (carrito.cantidad() === 0) {
            <div class="vacio" role="status">
              <p>Todavía no has escogido números.</p>
              <a class="boton" [routerLink]="['/rifa', r.codigo]" fragment="numeros">Escoger números</a>
            </div>
          } @else {
            <div class="columnas">
              <form class="formulario" novalidate (submit)="enviar($event)" aria-labelledby="titulo-datos">
                <h2 id="titulo-datos">Tus datos</h2>

                <div class="campo">
                  <label for="nombre">Nombre completo</label>
                  <input id="nombre" name="nombre" type="text" autocomplete="name" maxlength="120"
                         [value]="nombre()" (input)="nombre.set($any($event.target).value)" (blur)="tocoNombre.set(true)"
                         [attr.aria-invalid]="errorNombre() ? 'true' : null"
                         [attr.aria-describedby]="errorNombre() ? 'e-nombre' : null" />
                  @if (errorNombre(); as e) { <p id="e-nombre" class="error">{{ e }}</p> }
                </div>

                <div class="campo">
                  <label for="telefono">Celular (WhatsApp)</label>
                  <input id="telefono" name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="300 123 4567"
                         [value]="telefono()" (input)="telefono.set($any($event.target).value)" (blur)="tocoTelefono.set(true)"
                         [attr.aria-invalid]="errorTelefono() ? 'true' : null"
                         [attr.aria-describedby]="errorTelefono() ? 'e-telefono ayuda-telefono' : 'ayuda-telefono'" />
                  <p id="ayuda-telefono" class="ayuda">
                    Con este número encuentras tu reserva y el organizador te contacta para el pago.
                  </p>
                  @if (errorTelefono(); as e) { <p id="e-telefono" class="error">{{ e }}</p> }
                </div>

                @if (errorEnvio(); as e) {
                  <div class="falla" role="alert">
                    <p>{{ e.message }}</p>
                    @if (e.estado === 409) {
                      <a [routerLink]="['/rifa', r.codigo]" fragment="numeros">Volver a elegir números</a>
                    }
                  </div>
                }

                <button class="boton" type="submit" [disabled]="enviando()">
                  {{ enviando() ? 'Reservando…' : 'Reservar ' + carrito.cantidad() + (carrito.cantidad() === 1 ? ' número' : ' números') }}
                </button>
                <p class="nota">Proyecto de demostración: no se cobra ni se entrega ningún premio real.</p>
              </form>

              <aside class="resumen" aria-label="Resumen de tu reserva">
                <h2>Tu selección</h2>
                <ul class="fichas">
                  @for (n of carrito.numeros(); track n) {
                    <li>
                      <button type="button" class="ficha" (click)="carrito.quitar(n)" [attr.aria-label]="'Quitar el número ' + texto(n)">
                        {{ texto(n) }} <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  }
                </ul>
                <dl>
                  <dt>Precio por número</dt><dd>{{ moneda(r.precioBoleto) }}</dd>
                  <dt>Cantidad</dt><dd>{{ carrito.cantidad() }}</dd>
                  <dt class="total">Total a pagar</dt><dd class="total">{{ moneda(carrito.total()) }}</dd>
                </dl>
                <p class="nota">
                  Reservamos tus números por {{ duracion() }}. Si en ese tiempo no se confirma el pago, vuelven a quedar libres.
                </p>
              </aside>
            </div>
          }
        }
      </app-aviso-carga>
    </section>
  `,
  styles: `
    .volver { display: inline-block; margin-block: var(--e4) var(--e3); }
    .rifa-nombre { color: var(--tinta-suave); font-weight: 600; }
    .columnas { display: grid; gap: var(--e5); align-items: start; padding-bottom: var(--e6); }
    @media (min-width: 56rem) { .columnas { grid-template-columns: 1fr 22rem; } .resumen { position: sticky; top: var(--e4); } }
    h2 { font-size: var(--t1); }
    .vacio { padding-block: var(--e4); }

    .formulario, .resumen { background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); padding: var(--e4); }
    .campo { margin-bottom: var(--e4); }
    .campo label { display: block; font-weight: 600; margin-bottom: var(--e1); }
    .campo input {
      width: 100%; min-height: 2.75rem; padding-inline: var(--e3); border-radius: var(--radio);
      border: 1px solid var(--linea); background: var(--papel); color: var(--tinta); font: inherit;
    }
    .campo input[aria-invalid='true'] { border: 2px solid var(--error); }
    .ayuda { margin: var(--e1) 0 0; color: var(--tinta-suave); font-size: var(--t-1); }
    .error { margin: var(--e1) 0 0; color: var(--error); font-size: var(--t-1); font-weight: 600; }
    .falla { margin-bottom: var(--e4); padding: var(--e3); border-left: 4px solid var(--error); background: var(--papel); }
    .falla p { margin: 0 0 var(--e1); font-weight: 600; max-width: none; }
    .formulario .boton { width: 100%; }
    .formulario .boton:disabled { opacity: 0.6; cursor: progress; }
    .nota { margin: var(--e3) 0 0; font-size: var(--t-1); color: var(--tinta-suave); }

    .fichas { display: flex; flex-wrap: wrap; gap: var(--e2); margin: 0 0 var(--e4); padding: 0; list-style: none; }
    .ficha {
      min-height: 2.25rem; padding: 0 var(--e3); border-radius: 999px; cursor: pointer;
      border: 2px solid var(--tinta); background: var(--sol); color: var(--sol-texto); font: 700 var(--t-1) var(--fuente-titulo);
    }
    dl { display: grid; grid-template-columns: 1fr auto; gap: var(--e2) var(--e3); margin: 0; font-size: var(--t-1); }
    dt { color: var(--tinta-suave); }
    dd { margin: 0; font-weight: 600; text-align: right; }
    dt.total, dd.total { font: 800 var(--t0) var(--fuente-titulo); color: var(--tinta); padding-top: var(--e2); border-top: 1px dashed var(--linea); }
  `,
})
export class Reservar {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly titulo = inject(Title);
  protected readonly carrito = inject(Carrito);

  /** Parámetro de ruta `:codigo` (withComponentInputBinding). */
  readonly codigo = input.required<string>();

  protected readonly rifa = signal<RifaDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<ApiError | null>(null);

  protected readonly nombre = signal('');
  protected readonly telefono = signal('');
  protected readonly tocoNombre = signal(false);
  protected readonly tocoTelefono = signal(false);
  private readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<ApiError | null>(null);

  protected readonly errorNombre = computed(() => {
    if (!this.tocoNombre() && !this.intento()) return '';
    const n = limpiarNombre(this.nombre());
    if (n.length < 2) return 'Escribe tu nombre (mínimo 2 letras).';
    return n.length > 120 ? 'El nombre es demasiado largo (máximo 120 caracteres).' : '';
  });
  protected readonly errorTelefono = computed(() => {
    if (!this.tocoTelefono() && !this.intento()) return '';
    return normalizarTelefono(this.telefono()) ? '' : 'Escribe un celular colombiano válido de 10 dígitos (ej. 300 123 4567).';
  });

  protected readonly duracion = computed(() => formatearDuracion(this.rifa()?.reservaMinutos ?? 15));

  constructor() {
    effect(() => { this.codigo(); this.cargar(); });
  }

  protected moneda(v: number): string { return formatearMoneda(v, this.rifa()?.moneda); }
  protected texto(n: number): string { return formatearNumero(n, this.rifa()?.digitos); }

  protected cargar(): void {
    const codigo = this.codigo();
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.rifa.set(null);
    this.api.rifa(codigo).subscribe({
      next: (r) => {
        if (codigo !== this.codigo()) return; // llegó tarde: ya se navegó a otra rifa
        // Con F5 el carrito está vacío en memoria: configurar() recupera la selección guardada de esta rifa.
        this.carrito.configurar({ codigo: r.codigo, precio: r.precioBoleto, moneda: r.moneda, maximo: r.maximoBoletosPorCompra, digitos: r.digitos });
        this.rifa.set(r);
        this.titulo.setTitle(`Reservar · ${r.titulo} · Alex Rifas`);
        this.cargando.set(false);
      },
      error: (e: ApiError) => {
        if (codigo !== this.codigo()) return;
        this.errorCarga.set(e.estado === 404 ? new ApiError('Esta rifa no existe o ya no está disponible.', 404) : e);
        this.cargando.set(false);
      },
    });
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const r = this.rifa();
    if (!r || this.enviando()) return; // evita doble envío (doble clic = dos reservas)
    this.intento.set(true);
    const nombre = limpiarNombre(this.nombre());
    const telefono = normalizarTelefono(this.telefono());
    if (this.errorNombre() || this.errorTelefono() || !telefono || this.carrito.cantidad() === 0) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.api.reservar({ codigoRifa: r.codigo, nombre, telefono, numeros: [...this.carrito.numeros()] }).subscribe({
      next: (reserva) => {
        guardarTelefono(reserva.codigo, telefono);
        this.carrito.vaciar();
        this.enviando.set(false);
        void this.router.navigate(['/reserva', reserva.codigo]);
      },
      error: (e: unknown) => {
        this.errorEnvio.set(e instanceof ApiError ? e : new ApiError('No pudimos crear la reserva. Inténtalo de nuevo.', -1));
        this.enviando.set(false);
      },
    });
  }
}
