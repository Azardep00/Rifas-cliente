import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ErrorDto } from './models';

/** Error ya traducido para mostrarlo a la persona usuaria. */
export class ApiError extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
    /** Segundos de espera sugeridos (429 con Retry-After). */
    readonly reintentarEn?: number,
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }

  /** Estado 0: el navegador no logró hablar con la API (servidor dormido o sin red). */
  get sinConexion(): boolean {
    return this.estado === 0;
  }
}

export function traducirError(e: HttpErrorResponse): ApiError {
  if (e.status === 0) {
    return new ApiError(
      'No pudimos conectar con el servidor. Puede estar despertando: espera un minuto e inténtalo de nuevo.',
      0,
    );
  }
  const cuerpo = e.error as Partial<ErrorDto> | null;
  const mensaje =
    typeof cuerpo?.mensaje === 'string' && cuerpo.mensaje
      ? cuerpo.mensaje
      : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  const retry = Number(e.headers?.get('Retry-After'));
  return new ApiError(mensaje, e.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((e: unknown) =>
      throwError(() => (e instanceof HttpErrorResponse ? traducirError(e) : e)),
    ),
  );
