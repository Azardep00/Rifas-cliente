import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { RifaDetalle, RifaResumen } from '../core/api/models';

/** Soporte de las pruebas de pantallas (no entra al bundle). */
export const proveedoresPrueba = () => [
  provideRouter([]),
  provideHttpClient(withInterceptors([errorInterceptor])),
  provideHttpClientTesting(),
];

export const resumen = (o: Partial<RifaResumen> = {}): RifaResumen => ({
  codigo: 'R-001', titulo: 'Moto 0 km', estado: 'PUBLICADA', precioBoleto: 10000, moneda: 'COP',
  cantidadBoletos: 100, boletosDisponibles: 75, fechaSorteo: '2026-11-15T15:00:00Z', ...o,
});

export const detalle = (o: Partial<RifaDetalle> = {}): RifaDetalle => ({
  codigo: 'R-001', titulo: 'Moto 0 km', descripcion: 'Una moto nueva.', estado: 'PUBLICADA',
  precioBoleto: 10000, moneda: 'COP', cantidadBoletos: 100, fechaSorteo: '2026-11-15T15:00:00Z',
  cierreVentasEn: '2026-11-14T15:00:00Z', maximoBoletosPorCompra: 10, metodoSorteo: 'LOTERIA',
  loteriaNombre: 'Lotería de Bogotá', organizador: 'Alex', digitos: 2,
  reglaVacante: 'REPETIR_SIGUIENTE_LOTERIA', reservaMinutos: 60,
  disponibilidad: { disponibles: 75, reservados: 5, vendidos: 20 },
  premios: [
    { posicion: 1, nombre: 'Moto', valorEstimado: 8000000 },
    { posicion: 2, nombre: 'Casco' },
  ], ...o,
});
