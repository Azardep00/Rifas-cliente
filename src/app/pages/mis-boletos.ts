import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../core/api/api-error';
import { ApiService } from '../core/api/api.service';
import { guardarTelefono, olvidarReserva, reservasGuardadas } from '../core/reservas-locales';
import { normalizarTelefono } from '../core/telefono';

/** El código de reserva que entrega la API (sin espacios). Se valida solo la forma; la API decide si existe. */
export const FORMA_CODIGO = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * «Mis boletos»: la API solo deja ver una reserva con código + celular (no hay cuentas ni búsqueda por celular),
 * así que aquí se piden los dos datos. Además se listan las reservas hechas desde este navegador.
 */
@Component({
  selector: 'app-mis-boletos',
  imports: [RouterLink],
  template: `
    <section class="contenedor">
      <h1>Mis boletos</h1>
      <p class="lead">Consulta tu reserva con el código que recibiste al reservar y el celular que usaste.</p>

      <form class="formulario" novalidate (submit)="buscar($event)" aria-labelledby="t-buscar">
        <h2 id="t-buscar">Buscar una reserva</h2>

        <div class="campo">
          <label for="codigo">Código de reserva</label>
          <input id="codigo" name="codigo" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64"
                 [value]="codigo()" (input)="codigo.set($any($event.target).value)" (blur)="tocoCodigo.set(true)"
                 [attr.aria-invalid]="errorCodigo() ? 'true' : null" [attr.aria-describedby]="errorCodigo() ? 'e-codigo' : null" />
          @if (errorCodigo(); as e) { <p id="e-codigo" class="error">{{ e }}</p> }
        </div>

        <div class="campo">
          <label for="telefono">Celular con el que reservaste</label>
          <input id="telefono" name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="300 123 4567"
                 [value]="telefono()" (input)="telefono.set($any($event.target).value)" (blur)="tocoTelefono.set(true)"
                 [attr.aria-invalid]="errorTelefono() ? 'true' : null" [attr.aria-describedby]="errorTelefono() ? 'e-telefono' : null" />
          @if (errorTelefono(); as e) { <p id="e-telefono" class="error">{{ e }}</p> }
        </div>

        @if (errorEnvio(); as e) {
          <div class="falla" role="alert"><p>{{ e.message }}</p></div>
        }

        <button class="boton" type="submit" [disabled]="enviando()">{{ enviando() ? 'Buscando…' : 'Buscar mi reserva' }}</button>
        <p class="nota">Por seguridad, solo quien conoce el código y el celular puede ver una reserva.</p>
      </form>

      <h2 class="subtitulo">En este dispositivo</h2>
      @if (guardadas().length) {
        <ul class="guardadas" aria-label="Reservas hechas desde este dispositivo">
          @for (g of guardadas(); track g) {
            <li>
              <a [routerLink]="['/reserva', g]">Reserva <code>{{ g }}</code></a>
              <button type="button" class="quitar" (click)="quitar(g)" [attr.aria-label]="'Quitar la reserva ' + g + ' de este dispositivo'">Quitar</button>
            </li>
          }
        </ul>
        <p class="nota">Quitar una reserva solo la borra de este dispositivo; no la cancela.</p>
      } @else {
        <p class="vacio">Aún no has reservado desde este dispositivo.</p>
        <a class="boton boton--secundario" routerLink="/">Ver rifas</a>
      }
    </section>
  `,
  styles: `
    section { padding-block: var(--e5) var(--e6); }
    .lead { max-width: 48ch; color: var(--tinta-suave); }
    h2 { font-size: var(--t1); }
    .subtitulo { margin-top: var(--e6); }
    .formulario { max-width: 30rem; padding: var(--e4); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); }
    .formulario h2 { margin-top: 0; }
    .campo { margin-bottom: var(--e4); }
    .campo label { display: block; font-weight: 600; margin-bottom: var(--e1); }
    .campo input {
      width: 100%; min-height: 2.75rem; padding-inline: var(--e3); border-radius: var(--radio);
      border: 1px solid var(--linea); background: var(--papel); color: var(--tinta); font: inherit;
    }
    .campo input[aria-invalid='true'] { border: 2px solid var(--error); }
    .error { margin: var(--e1) 0 0; color: var(--error); font-size: var(--t-1); font-weight: 600; }
    .falla { margin-bottom: var(--e4); padding: var(--e3); border-left: 4px solid var(--error); background: var(--papel); }
    .falla p { margin: 0; font-weight: 600; max-width: none; }
    .formulario .boton { width: 100%; }
    .formulario .boton:disabled { opacity: 0.6; cursor: progress; }
    .nota { margin: var(--e3) 0 0; font-size: var(--t-1); color: var(--tinta-suave); }
    .vacio { color: var(--tinta-suave); }
    .guardadas { display: grid; gap: var(--e2); max-width: 30rem; margin: 0; padding: 0; list-style: none; }
    .guardadas li {
      display: flex; align-items: center; justify-content: space-between; gap: var(--e3);
      padding: var(--e2) var(--e3); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio);
    }
    .guardadas a { flex: 1; min-width: 0; padding-block: var(--e2); }
    .guardadas code { overflow-wrap: anywhere; word-break: break-all; }
    .quitar { min-height: 2.75rem; padding-inline: var(--e3); background: none; border: 0; color: var(--tinta-suave); text-decoration: underline; cursor: pointer; font: inherit; }
  `,
})
export class MisBoletos {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly codigo = signal('');
  protected readonly telefono = signal('');
  protected readonly tocoCodigo = signal(false);
  protected readonly tocoTelefono = signal(false);
  private readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<ApiError | null>(null);
  protected readonly guardadas = signal(reservasGuardadas().map((r) => r.codigo));

  protected readonly errorCodigo = computed(() => {
    if (!this.tocoCodigo() && !this.intento()) return '';
    return FORMA_CODIGO.test(this.codigo().trim()) ? '' : 'Escribe el código de tu reserva, sin espacios.';
  });
  protected readonly errorTelefono = computed(() => {
    if (!this.tocoTelefono() && !this.intento()) return '';
    return normalizarTelefono(this.telefono()) ? '' : 'Escribe un celular colombiano válido de 10 dígitos (ej. 300 123 4567).';
  });

  protected buscar(evento: Event): void {
    evento.preventDefault();
    if (this.enviando()) return; // evita consultas dobles
    this.intento.set(true);
    const codigo = this.codigo().trim();
    const telefono = normalizarTelefono(this.telefono());
    if (this.errorCodigo() || this.errorTelefono() || !telefono) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.api.consultarReserva(codigo, telefono).subscribe({
      next: (reserva) => {
        guardarTelefono(reserva.codigo, telefono); // código canónico que devuelve la API
        this.enviando.set(false);
        void this.router.navigate(['/reserva', reserva.codigo]);
      },
      error: (e: unknown) => {
        this.errorEnvio.set(e instanceof ApiError ? e : new ApiError('No pudimos consultar la reserva. Inténtalo de nuevo.', -1));
        this.enviando.set(false);
      },
    });
  }

  protected quitar(codigo: string): void {
    olvidarReserva(codigo);
    this.guardadas.set(reservasGuardadas().map((r) => r.codigo));
  }
}
