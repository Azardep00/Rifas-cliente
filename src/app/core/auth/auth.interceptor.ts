import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { Sesion } from './sesion';

/** Solo las rutas privadas llevan el token; las públicas y /api/auth nunca (no filtrar el JWT a donde no hace falta). */
export function esRutaPrivada(url: string): boolean {
  return /^\/api\/(admin|organizador)(\/|$|\?)/.test(url);
}

const conToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Agrega el Bearer a /api/admin y /api/organizador. Ante un 401 intenta UN refresh y repite la petición;
 * si el refresh falla (vencido o reutilizado) cierra la sesión y manda al login. Va después de errorInterceptor
 * en la lista para ver el HttpErrorResponse original.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esRutaPrivada(req.url)) return next(req);
  const sesion = inject(Sesion);
  const router = inject(Router);
  const token = sesion.accessToken();
  const enviada = token ? conToken(req, token) : req;

  return next(enviada).pipe(
    catchError((e: unknown) => {
      if (!(e instanceof HttpErrorResponse) || e.status !== 401 || !token) return throwError(() => e);
      return sesion.refrescar().pipe(
        catchError((r: unknown) => {
          void router.navigate(['/admin/login'], { queryParams: { expirada: 1 } });
          return throwError(() => r);
        }),
        switchMap((nuevo) => next(conToken(req, nuevo))),
      );
    }),
  );
};
