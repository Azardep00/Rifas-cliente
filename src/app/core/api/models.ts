/**
 * Contrato público de la API (espejo de los records Java en com.alexrifas.api.dto).
 * Fechas Instant -> string ISO-8601; BigDecimal -> number; enums -> unión de literales.
 * Cuando el CP-20 fije la URL de producción, este archivo puede regenerarse desde /v3/api-docs (ADR-09).
 */
export type EstadoRifa = 'BORRADOR' | 'PUBLICADA' | 'CERRADA' | 'SORTEADA' | 'CANCELADA';
export type MetodoSorteo = 'ALEATORIO' | 'LOTERIA' | 'MANUAL';
export type ReglaVacante = 'REPETIR_SIGUIENTE_LOTERIA' | 'ADJUDICAR_SIGUIENTE_VENDIDO';
export type EstadoCompra = 'PENDIENTE' | 'CONFIRMADA' | 'EXPIRADA' | 'CANCELADA';

export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface Disponibilidad {
  disponibles: number;
  reservados: number;
  vendidos: number;
}

export interface Premio {
  posicion: number;
  nombre: string;
  descripcion?: string;
  valorEstimado?: number;
  imagenUrl?: string;
}

export interface RifaResumen {
  codigo: string;
  titulo: string;
  imagenUrl?: string;
  estado: EstadoRifa;
  precioBoleto: number;
  moneda: string;
  cantidadBoletos: number;
  boletosDisponibles: number;
  fechaSorteo: string;
}

export interface RifaDetalle {
  codigo: string;
  titulo: string;
  descripcion?: string;
  imagenUrl?: string;
  estado: EstadoRifa;
  precioBoleto: number;
  moneda: string;
  cantidadBoletos: number;
  fechaSorteo: string;
  cierreVentasEn: string;
  maximoBoletosPorCompra: number;
  metodoSorteo: MetodoSorteo;
  loteriaNombre?: string;
  organizador: string;
  disponibilidad: Disponibilidad;
  premios: Premio[];
  /** 2, 3 o 4 en rifas por lotería; nulo en las demás. */
  digitos?: number;
  reglaVacante?: ReglaVacante;
  reservaMinutos: number;
}

/** `estados` trae un carácter por número: L libre, R reservado, V vendido. */
export interface GrillaBoletos {
  codigoRifa: string;
  cantidad: number;
  digitos?: number;
  estados: string;
  libres: number;
  reservados: number;
  vendidos: number;
  generadaEn: string;
}

export interface Ganador {
  codigoRifa: string;
  tituloRifa: string;
  posicionPremio: number;
  premio: string;
  numeroBoleto: number;
  publicado: boolean;
  creadoEn: string;
}

export interface ReservaRequest {
  codigoRifa: string;
  nombre: string;
  telefono: string;
  numeros: number[];
}

export interface Reserva {
  codigo: string;
  codigoRifa: string;
  estado: EstadoCompra;
  numeros: number[];
  subtotal: number;
  moneda: string;
  compradorNombre: string;
  telefonoEnmascarado: string;
  expiraEn?: string;
  creadaEn: string;
}

/** Cuerpo de error uniforme de la API (ApiExceptionHandler.ErrorDto). */
export interface ErrorDto {
  fecha: string;
  estado: number;
  error: string;
  mensaje: string;
  ruta: string;
}

/** Autenticación (AuthDtos.java). */
export type Rol = 'ADMIN' | 'ORGANIZADOR' | 'CLIENTE';

export interface UsuarioResumen {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: Rol;
}

export interface AuthResponse {
  tipo: string;
  accessToken: string;
  refreshToken: string;
  expiraEnSegundos: number;
  usuario: UsuarioResumen;
}
