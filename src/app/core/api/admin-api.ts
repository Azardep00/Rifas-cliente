import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.service';
import {
  CompraAdmin, ConfirmacionManualRequest, ConfirmacionPago, EstadoCompra, EstadoResultado, Liberacion, Loteria, Pagina,
  Premio, PremioRequest, ResultadoLoteria, RifaGestion, RifaRequest, SorteoLoteria,
} from './models';

/** Filtros de la cola de pagos; todo es opcional. */
export interface FiltroCompras {
  estado?: EstadoCompra;
  rifa?: string;
  telefono?: string;
  numero?: number;
  pagina?: number;
  tamano?: number;
}

/** Endpoints de gestión. Van bajo /api/organizador/** (ORGANIZADOR o ADMIN); el interceptor pone el Bearer. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  misRifas(pagina = 0, tamano = 50): Observable<Pagina<RifaGestion>> {
    const params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    return this.http.get<Pagina<RifaGestion>>(`${API_BASE}/organizador/rifas`, { params });
  }

  crearRifa(r: RifaRequest): Observable<RifaGestion> {
    return this.http.post<RifaGestion>(`${API_BASE}/organizador/rifas`, r);
  }

  agregarPremio(rifaId: number, p: PremioRequest): Observable<Premio> {
    return this.http.post<Premio>(`${API_BASE}/organizador/rifas/${rifaId}/premios`, p);
  }

  publicar(rifaId: number): Observable<RifaGestion> {
    return this.http.post<RifaGestion>(`${API_BASE}/organizador/rifas/${rifaId}/publicar`, {});
  }

  loteriasActivas(): Observable<Loteria[]> {
    return this.http.get<Loteria[]>(`${API_BASE}/organizador/loterias`);
  }

  /** Cola de pagos (solo ADMIN en la API): `/api/admin/compras`. */
  compras(f: FiltroCompras): Observable<Pagina<CompraAdmin>> {
    let params = new HttpParams().set('pagina', f.pagina ?? 0).set('tamano', f.tamano ?? 20);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.rifa) params = params.set('rifa', f.rifa);
    if (f.telefono) params = params.set('telefono', f.telefono);
    if (f.numero !== undefined) params = params.set('numero', f.numero);
    return this.http.get<Pagina<CompraAdmin>>(`${API_BASE}/admin/compras`, { params });
  }

  confirmarPago(codigo: string, r: ConfirmacionManualRequest): Observable<ConfirmacionPago> {
    return this.http.post<ConfirmacionPago>(`${API_BASE}/admin/compras/${encodeURIComponent(codigo)}/confirmar-pago-manual`, r);
  }

  liberar(codigo: string, motivo?: string): Observable<Liberacion> {
    return this.http.post<Liberacion>(`${API_BASE}/admin/compras/${encodeURIComponent(codigo)}/liberar`, motivo ? { motivo } : {});
  }

  /** Cierra las ventas (PUBLICADA → CERRADA). `/api/organizador/**`. */
  cerrar(rifaId: number): Observable<RifaGestion> {
    return this.http.post<RifaGestion>(`${API_BASE}/organizador/rifas/${rifaId}/cerrar`, {});
  }

  // ---- Sorteo por lotería: todo bajo /api/admin/** (solo ADMIN) ----

  /** Qué ganaría cada premio con los resultados actuales; no guarda nada. */
  previsualizarSorteo(rifaId: number): Observable<SorteoLoteria> {
    return this.http.get<SorteoLoteria>(`${API_BASE}/admin/rifas/${rifaId}/sortear-por-loteria/previsualizar`);
  }

  /** Ejecuta el sorteo y deja la rifa SORTEADA; 409 si algo cambió. */
  ejecutarSorteo(rifaId: number): Observable<SorteoLoteria> {
    return this.http.post<SorteoLoteria>(`${API_BASE}/admin/rifas/${rifaId}/sortear-por-loteria`, {});
  }

  resultadosLoteria(loteriaId: number, estado?: EstadoResultado, pagina = 0, tamano = 20): Observable<Pagina<ResultadoLoteria>> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    return this.http.get<Pagina<ResultadoLoteria>>(`${API_BASE}/admin/loterias/${loteriaId}/resultados`, { params });
  }

  verificarResultado(resultadoId: number): Observable<ResultadoLoteria> {
    return this.http.post<ResultadoLoteria>(`${API_BASE}/admin/resultados-loteria/${resultadoId}/verificar`, {});
  }
}
