import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Ganador, GrillaBoletos, Pagina, Reserva, ReservaRequest, RifaDetalle, RifaResumen } from './models';

/** Mismo origen: en dev lo atiende proxy.conf.json y en producción el rewrite de vercel.json (ADR-03). */
export const API_BASE = '/api';

/** Endpoints públicos (sin cuenta). Los de administración llegan con el CP-16. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  rifas(pagina = 0, tamano = 12): Observable<Pagina<RifaResumen>> {
    const params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    return this.http.get<Pagina<RifaResumen>>(`${API_BASE}/rifas`, { params });
  }

  rifa(codigo: string): Observable<RifaDetalle> {
    return this.http.get<RifaDetalle>(`${API_BASE}/rifas/${encodeURIComponent(codigo)}`);
  }

  grilla(codigo: string): Observable<GrillaBoletos> {
    return this.http.get<GrillaBoletos>(`${API_BASE}/rifas/${encodeURIComponent(codigo)}/boletos`);
  }

  ganadores(codigo: string): Observable<Ganador[]> {
    return this.http.get<Ganador[]>(`${API_BASE}/rifas/${encodeURIComponent(codigo)}/ganadores`);
  }

  reservar(request: ReservaRequest): Observable<Reserva> {
    return this.http.post<Reserva>(`${API_BASE}/publico/reservas`, request);
  }

  consultarReserva(codigo: string, telefono: string): Observable<Reserva> {
    const params = new HttpParams().set('telefono', telefono);
    return this.http.get<Reserva>(`${API_BASE}/publico/reservas/${encodeURIComponent(codigo)}`, { params });
  }
}
