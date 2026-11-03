import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { Sesion } from './sesion';

/**
 * Deja pasar solo ADMIN u ORGANIZADOR. Sin sesión -> login (recordando a dónde iba);
 * con sesión de otro rol (p. ej. CLIENTE) -> inicio. canMatch evita incluso descargar el código del panel.
 */
function evaluar(destino: string): boolean | UrlTree {
  const sesion = inject(Sesion);
  const router = inject(Router);
  if (sesion.esDelPanel()) return true;
  if (!sesion.autenticado()) return router.createUrlTree(['/admin/login'], { queryParams: { volver: destino } });
  return router.createUrlTree(['/']);
}

export const panelMatch: CanMatchFn = (_ruta: Route, segmentos: UrlSegment[]) =>
  evaluar('/' + segmentos.map((s) => s.path).join('/'));

export const panelGuard: CanActivateFn = (_ruta, estado) => evaluar(estado.url);

/** El login no tiene sentido con sesión de panel abierta: va directo al panel. */
export const soloSinSesionGuard: CanActivateFn = () => {
  const sesion = inject(Sesion);
  return sesion.esDelPanel() ? inject(Router).createUrlTree(['/admin']) : true;
};
