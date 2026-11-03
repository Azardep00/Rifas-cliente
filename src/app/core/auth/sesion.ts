import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { API_BASE } from '../api/api.service';
import { AuthResponse, Rol, UsuarioResumen } from '../api/models';

const CLAVE = 'alex-rifas:sesion';
/** Roles que pueden entrar al panel (el backend: /api/admin/** = ADMIN, /api/organizador/** = ORGANIZADOR o ADMIN). */
export const ROLES_PANEL: readonly Rol[] = ['ADMIN', 'ORGANIZADOR'];

interface Guardado {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioResumen;
}

/** Error de acceso: la cuenta existe pero su rol no entra al panel. */
export class SinPermisoPanel extends Error {
  constructor() {
    super('Esta cuenta no tiene acceso al panel de administración.');
    this.name = 'SinPermisoPanel';
  }
}

/**
 * Sesión del panel. El access token vive en memoria y en localStorage (el panel se usa desde el celular y
 * debe sobrevivir a recargas); el refresh token rota en cada uso (el backend revoca todo si se reutiliza).
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly http = inject(HttpClient);
  private readonly estado = signal<Guardado | null>(this.leer());
  private refrescando$: Observable<string> | null = null;

  readonly usuario = computed(() => this.estado()?.usuario ?? null);
  readonly rol = computed(() => this.usuario()?.rol ?? null);
  readonly autenticado = computed(() => this.estado() !== null);
  readonly esDelPanel = computed(() => {
    const r = this.rol();
    return r !== null && ROLES_PANEL.includes(r);
  });

  accessToken(): string | null {
    return this.estado()?.accessToken ?? null;
  }

  tieneRol(roles: readonly Rol[]): boolean {
    const r = this.rol();
    return r !== null && roles.includes(r);
  }

  /** Inicia sesión; si el rol no es de panel, cierra lo recién abierto y falla con SinPermisoPanel. */
  entrar(correo: string, contrasena: string): Observable<UsuarioResumen> {
    return this.http.post<AuthResponse>(`${API_BASE}/auth/login`, { correo: correo.trim(), contrasena }).pipe(
      tap((r) => this.guardar(r)),
      map((r) => r.usuario),
      tap((u) => {
        if (!ROLES_PANEL.includes(u.rol)) {
          this.salir().subscribe();
          throw new SinPermisoPanel();
        }
      }),
    );
  }

  /** Canjea el refresh token. Varias llamadas simultáneas comparten una sola petición (el token rota). */
  refrescar(): Observable<string> {
    const actual = this.estado();
    if (!actual) return throwError(() => new Error('Sin sesión'));
    if (this.refrescando$) return this.refrescando$;
    this.refrescando$ = this.http
      .post<AuthResponse>(`${API_BASE}/auth/refresh`, { refreshToken: actual.refreshToken })
      .pipe(
        tap((r) => this.guardar(r)),
        map((r) => r.accessToken),
        catchError((e: unknown) => {
          this.limpiar();
          return throwError(() => e);
        }),
        finalize(() => (this.refrescando$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refrescando$;
  }

  /** Cierra sesión aquí siempre; avisa a la API para revocar el refresh token (si falla, no importa). */
  salir(): Observable<void> {
    const actual = this.estado();
    this.limpiar();
    if (!actual) return of(undefined);
    return this.http.post<void>(`${API_BASE}/auth/logout`, { refreshToken: actual.refreshToken }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  private guardar(r: AuthResponse): void {
    const g: Guardado = { accessToken: r.accessToken, refreshToken: r.refreshToken, usuario: r.usuario };
    this.estado.set(g);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(g));
    } catch {
      /* almacenamiento bloqueado: la sesión dura mientras la pestaña siga abierta */
    }
  }

  private limpiar(): void {
    this.estado.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada que limpiar */
    }
  }

  private leer(): Guardado | null {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Guardado> | null;
      if (d && typeof d.accessToken === 'string' && typeof d.refreshToken === 'string' && d.usuario && typeof d.usuario.rol === 'string') {
        return d as Guardado;
      }
    } catch {
      /* dato corrupto: se ignora */
    }
    return null;
  }
}
