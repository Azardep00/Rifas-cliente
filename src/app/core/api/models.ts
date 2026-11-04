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

/** Gestión (CP-17): espejo de RifaDtos.RifaRequest / PremioRequest / RifaGestionDto y LoteriaDtos.LoteriaDto. */
export type TipoLoteria = 'LOTERIA' | 'CHANCE';

export interface Loteria {
  id: number;
  nombre: string;
  tipo: TipoLoteria;
  diasSemana: number[];
  horaSorteo?: string;
  sitioOficialUrl?: string;
  activa: boolean;
}

export interface RifaRequest {
  titulo: string;
  descripcion?: string;
  imagenUrl?: string;
  precioBoleto: number;
  moneda: string;
  cantidadBoletos: number;
  fechaSorteo: string;
  cierreVentasEn: string;
  maximoBoletosPorCompra: number;
  metodoSorteo: MetodoSorteo;
  loteriaNombre?: string;
  numeroAutorizacion?: string;
  entidadAutorizadora?: string;
  loteriaId?: number;
  digitos?: number;
  reglaVacante?: ReglaVacante;
  reservaMinutos?: number;
}

export interface PremioRequest {
  posicion: number;
  nombre: string;
  descripcion?: string;
  valorEstimado?: number;
  imagenUrl?: string;
}

export interface RifaGestion {
  id: number;
  codigo: string;
  titulo: string;
  estado: EstadoRifa;
  precioBoleto: number;
  moneda: string;
  cantidadBoletos: number;
  fechaSorteo: string;
  cierreVentasEn: string;
  maximoBoletosPorCompra: number;
  metodoSorteo: MetodoSorteo;
  numeroAutorizacion?: string;
  entidadAutorizadora?: string;
  disponibilidad: Disponibilidad;
  loteriaId?: number;
  digitos?: number;
  reglaVacante?: ReglaVacante;
  reservaMinutos: number;
}

/** Fila de la cola de pagos (`CompraAdminDto`). El teléfono llega completo con prefijo, p. ej. "+573001234567". */
export interface CompraAdmin {
  codigo: string;
  codigoRifa: string | null;
  estado: EstadoCompra;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  usuarioId: number | null;
  numeros: number[];
  subtotal: number;
  moneda: string | null;
  expiraEn: string;
  creadaEn: string;
  actualizadaEn: string;
}

export interface ConfirmacionManualRequest {
  metodo: string;
  observacion?: string;
}

export interface ConfirmacionPago {
  codigoCompra: string;
  estado: EstadoCompra;
  referenciaPago: string;
  confirmadoEn: string;
}

export interface Liberacion {
  codigo: string;
  estado: EstadoCompra;
  boletosLiberados: number;
  liberadaEn: string;
}

/** Sorteo por lotería (CP-19): espejo de SorteoDtos y LoteriaDtos.ResultadoDto. Los números van como texto con ceros (ADR-06). */
export type EstadoResultado = 'PENDIENTE_VERIFICACION' | 'VERIFICADO' | 'ANULADO';
export type ResolucionPaso = 'DIRECTO' | 'ADJUDICADO_SIGUIENTE_VENDIDO' | 'REPETIDO';
export type CausaVacante = 'NO_VENDIDO' | 'YA_GANO_OTRO_PREMIO';

export interface ResultadoLoteria {
  id: number;
  loteriaId: number;
  loteria: string;
  sitioOficialUrl?: string;
  fechaSorteo: string;
  numeroMayor: string;
  serie?: string;
  numeroSorteo?: number;
  ultimos2: string;
  ultimos3: string;
  ultimos4: string;
  fuente?: string;
  evidenciaUrl?: string;
  notas?: string;
  estado: EstadoResultado;
  cargadoPor?: number;
  creadoEn: string;
  verificadoPor?: number;
  verificadoEn?: string;
  anuladoPor?: number;
  anuladoEn?: string;
  motivoAnulacion?: string;
}

export interface PasoLoteria {
  posicionPremio: number;
  resultadoId: number;
  fechaSorteoLoteria: string;
  numeroMayor: string;
  numeroObjetivo: string;
  resolucion: ResolucionPaso;
  /** Nulo cuando la resolución es DIRECTO. */
  causa: CausaVacante | null;
  /** Nulo cuando la resolución es REPETIDO. */
  numeroBoleto: string | null;
}

export interface GanadorLoteria {
  posicionPremio: number;
  premio: string;
  numeroBoleto: number;
  numeroBoletoTexto: string;
  resultadoId: number;
  numeroObjetivo: string;
  adjudicadoPorVacante: boolean;
}

export interface SorteoLoteria {
  codigoRifa: string;
  tituloRifa: string;
  loteria: string;
  digitos: number;
  reglaVacante: ReglaVacante;
  completo: boolean;
  ejecutado: boolean;
  mensaje: string;
  pasos: PasoLoteria[];
  ganadores: GanadorLoteria[];
}
