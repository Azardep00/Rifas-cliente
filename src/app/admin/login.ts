import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../core/api/api-error';
import { Sesion, SinPermisoPanel } from '../core/auth/sesion';

/** Solo se acepta volver a rutas internas del panel (evita redirecciones abiertas). */
export function destinoSeguro(volver: string | null): string {
  return volver && /^\/admin(\/|$)/.test(volver) && !volver.startsWith('//') && !volver.startsWith('/admin/login') ? volver : '/admin';
}

@Component({
  selector: 'app-admin-login',
  template: `
    <main class="pantalla">
      <form class="tarjeta" novalidate (submit)="enviar($event)" aria-labelledby="t-login">
        <p class="marca">Alex Rifas · Panel</p>
        <h1 id="t-login">Ingresar</h1>
        @if (expirada) { <p class="aviso" role="status">Tu sesión venció. Ingresa de nuevo.</p> }

        <div class="campo">
          <label for="correo">Correo</label>
          <input id="correo" name="correo" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false"
                 [value]="correo()" (input)="correo.set($any($event.target).value)" />
        </div>
        <div class="campo">
          <label for="contrasena">Contraseña</label>
          <div class="con-boton">
            <input id="contrasena" name="contrasena" [type]="ver() ? 'text' : 'password'" autocomplete="current-password"
                   [value]="contrasena()" (input)="contrasena.set($any($event.target).value)" />
            <button type="button" class="ojo" (click)="ver.set(!ver())" [attr.aria-pressed]="ver()">{{ ver() ? 'Ocultar' : 'Ver' }}</button>
          </div>
        </div>

        @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
        <button class="boton" type="submit" [disabled]="enviando()">{{ enviando() ? 'Ingresando…' : 'Ingresar' }}</button>
      </form>
    </main>
  `,
  styles: `
    .pantalla { min-height: 100dvh; display: grid; place-items: center; padding: var(--e3); background: var(--papel); }
    .tarjeta { width: min(26rem, 100%); background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); padding: var(--e4) var(--e3); }
    .marca { font-weight: 700; color: var(--tinta-suave); margin-bottom: var(--e2); }
    h1 { font-size: var(--t2); }
    .campo { display: grid; gap: var(--e1); margin-bottom: var(--e3); }
    label { font-weight: 600; }
    input { width: 100%; min-height: 3rem; padding: 0 var(--e3); font: inherit; font-size: 1rem; /* 16px: iOS no hace zoom */
      color: var(--tinta); background: var(--papel); border: 2px solid var(--linea); border-radius: var(--radio); }
    .con-boton { display: flex; gap: var(--e2); }
    .ojo { min-width: 4.5rem; min-height: 3rem; border: 2px solid var(--linea); border-radius: var(--radio); background: transparent; color: var(--tinta); font: 600 var(--t-1) var(--fuente-texto); cursor: pointer; }
    .boton { width: 100%; min-height: 3.25rem; }
    .boton[disabled] { opacity: 0.6; cursor: progress; }
    .error { color: var(--error); font-weight: 600; }
    .aviso { color: var(--tinta-suave); }
  `,
})
export class AdminLogin {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly correo = signal('');
  readonly contrasena = signal('');
  readonly ver = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly expirada = this.ruta.snapshot.queryParamMap.get('expirada') === '1';

  enviar(ev: Event): void {
    ev.preventDefault();
    if (this.enviando()) return;
    if (!this.correo().trim() || !this.contrasena()) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.sesion.entrar(this.correo(), this.contrasena()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigateByUrl(destinoSeguro(this.ruta.snapshot.queryParamMap.get('volver')));
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.contrasena.set('');
        this.error.set(
          e instanceof SinPermisoPanel ? e.message
          : e instanceof ApiError && e.estado === 401 ? 'Correo o contraseña incorrectos.'
          : e instanceof ApiError ? e.message
          : 'No se pudo ingresar. Inténtalo de nuevo.',
        );
      },
    });
  }
}
