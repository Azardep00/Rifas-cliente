import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize, retry, throwError, timer } from 'rxjs';

/** Una petición que tarda más que esto hace pensar que el servidor gratuito está despertando (~1 min). */
export const UMBRAL_LENTA_MS = 6000;
/** Reintentos de los GET cuando el proxy responde que el servidor aún no está: 12 × 5 s ≈ 1 min. */
export const REINTENTOS = 12;
export const ESPERA_REINTENTO_MS = 5000;
/** Pasado este tiempo la pantalla ofrece recargar a mano. */
export const SEGUNDOS_LARGO = 75;

/** Estados con los que el proxy (Vercel/Render) contesta mientras la API duerme; 0 = ni respuesta hubo. */
export function esFalloDeArranque(estado: number): boolean {
  return estado === 0 || estado === 502 || estado === 503 || estado === 504;
}

/** Reintentar solo si el fallo parece de arranque y la persona SÍ tiene red (sin red no sirve esperar). */
export function debeReintentar(e: unknown, enLinea: boolean): boolean {
  return e instanceof HttpErrorResponse && esFalloDeArranque(e.status) && enLinea;
}

/**
 * Estado global de "despertando el servidor" (CP-20). Cada petición a /api se registra: si pasa del umbral
 * o el proxy responde con fallo de arranque, se marca como lenta y la pantalla de aviso aparece; cuando la
 * última lenta termina, desaparece.
 */
@Injectable({ providedIn: 'root' })
export class Servidor {
  private readonly _despertando = signal(false);
  private readonly _segundos = signal(0);
  readonly despertando = this._despertando.asReadonly();
  readonly segundos = this._segundos.asReadonly();

  private siguiente = 0;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly marcadas = new Set<number>();
  private reloj: ReturnType<typeof setInterval> | null = null;
  private desde = 0;

  /** Registra una petición y devuelve su id. */
  iniciar(): number {
    const id = ++this.siguiente;
    this.temporizadores.set(id, setTimeout(() => this.marcar(id), UMBRAL_LENTA_MS));
    return id;
  }

  /** El proxy contestó con fallo de arranque: no esperes al umbral. */
  fallo(id: number): void {
    this.marcar(id);
  }

  terminar(id: number): void {
    const t = this.temporizadores.get(id);
    if (t !== undefined) clearTimeout(t);
    this.temporizadores.delete(id);
    this.marcadas.delete(id);
    if (this.marcadas.size === 0) this.apagar();
  }

  private marcar(id: number): void {
    if (!this.temporizadores.has(id)) return; // ya terminó
    this.marcadas.add(id);
    if (this._despertando()) return;
    this.desde = Date.now();
    this._segundos.set(0);
    this._despertando.set(true);
    this.reloj = setInterval(() => this._segundos.set(Math.floor((Date.now() - this.desde) / 1000)), 1000);
  }

  private apagar(): void {
    if (this.reloj !== null) clearInterval(this.reloj);
    this.reloj = null;
    this._despertando.set(false);
    this._segundos.set(0);
  }
}

/**
 * Va DESPUÉS de errorInterceptor y ANTES de authInterceptor: ve el HttpErrorResponse original y cada
 * reintento vuelve a pasar por el interceptor de token. Solo los GET se reintentan solos; un POST
 * (reservar, confirmar pago) nunca se repite sin que la persona lo decida.
 */
export const servidorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const servidor = inject(Servidor);
  const id = servidor.iniciar();
  const base = next(req);
  const peticion =
    req.method === 'GET'
      ? base.pipe(
          retry({
            count: REINTENTOS,
            delay: (e: unknown) => {
              const enLinea = typeof navigator === 'undefined' || navigator.onLine !== false;
              if (!debeReintentar(e, enLinea)) return throwError(() => e);
              servidor.fallo(id);
              return timer(ESPERA_REINTENTO_MS);
            },
          }),
        )
      : base;
  return peticion.pipe(finalize(() => servidor.terminar(id)));
};
