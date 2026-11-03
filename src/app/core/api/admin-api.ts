import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.service';
import { Loteria, Pagina, Premio, PremioRequest, RifaGestion, RifaRequest } from './models';

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
}
