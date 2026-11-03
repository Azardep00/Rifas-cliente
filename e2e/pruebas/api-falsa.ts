import { Page, Route } from '@playwright/test';

/**
 * API simulada en el navegador (page.route): el e2e es determinista y no necesita backend. Reproduce el
 * contrato de los DTO (core/api/models.ts) y la máquina de estados de una compra: PENDIENTE -> CONFIRMADA.
 */
export const CODIGO_RIFA = 'R-001';
export const CODIGO_RESERVA = 'RES-0001';
const N = 100;

export class ApiFalsa {
  estados = Array.from({ length: N }, () => 'L');
  compra: { estado: 'PENDIENTE' | 'CONFIRMADA'; numeros: number[]; nombre: string; telefono: string } | null = null;
  sorteada = false;
  numeroGanador = 7;
  peticiones: string[] = [];

  /** Simula el sorteo del backend (la UI de sorteo tiene su propio CP): la rifa pasa a SORTEADA con ganador. */
  sortear(): void {
    this.sorteada = true;
  }

  async instalar(page: Page): Promise<void> {
    await page.route('**/api/**', (route) => this.atender(route));
  }

  private rifa() {
    const v = this.estados.filter((e) => e === 'V').length;
    const r = this.estados.filter((e) => e === 'R').length;
    return {
      codigo: CODIGO_RIFA, titulo: 'Moto 0 km', descripcion: 'Una moto nueva.', estado: this.sorteada ? 'SORTEADA' : 'PUBLICADA',
      precioBoleto: 10000, moneda: 'COP', cantidadBoletos: N, fechaSorteo: '2030-11-15T15:00:00Z', cierreVentasEn: '2030-11-14T15:00:00Z',
      maximoBoletosPorCompra: 10, metodoSorteo: 'LOTERIA', loteriaNombre: 'Lotería de Bogotá', organizador: 'Alex', digitos: 2,
      reglaVacante: 'REPETIR_SIGUIENTE_LOTERIA', reservaMinutos: 60,
      disponibilidad: { disponibles: N - v - r, reservados: r, vendidos: v },
      premios: [{ posicion: 1, nombre: 'Moto', valorEstimado: 8000000 }],
    };
  }

  private reserva() {
    const c = this.compra!;
    return {
      codigo: CODIGO_RESERVA, codigoRifa: CODIGO_RIFA, estado: c.estado, numeros: c.numeros, subtotal: c.numeros.length * 10000,
      moneda: 'COP', compradorNombre: c.nombre, telefonoEnmascarado: '+57 300 *** 4567',
      expiraEn: new Date(Date.now() + 60 * 60_000).toISOString(), creadaEn: new Date().toISOString(),
    };
  }

  private compraAdmin() {
    const c = this.compra!;
    return {
      codigo: CODIGO_RESERVA, codigoRifa: CODIGO_RIFA, estado: c.estado, compradorNombre: c.nombre, compradorTelefono: c.telefono,
      usuarioId: null, numeros: c.numeros, subtotal: c.numeros.length * 10000, moneda: 'COP',
      expiraEn: new Date(Date.now() + 60 * 60_000).toISOString(), creadaEn: new Date().toISOString(), actualizadaEn: new Date().toISOString(),
    };
  }

  private async atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname;
    const m = req.method();
    this.peticiones.push(`${m} ${ruta}`);
    const json = (cuerpo: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });

    if (m === 'GET' && ruta === '/api/rifas') {
      const r = this.rifa();
      return json({ contenido: [{ codigo: r.codigo, titulo: r.titulo, estado: r.estado, precioBoleto: r.precioBoleto, moneda: 'COP',
        cantidadBoletos: N, boletosDisponibles: r.disponibilidad.disponibles, fechaSorteo: r.fechaSorteo }],
        pagina: 0, tamano: 12, totalElementos: 1, totalPaginas: 1 });
    }
    if (m === 'GET' && ruta === `/api/rifas/${CODIGO_RIFA}`) return json(this.rifa());
    if (m === 'GET' && ruta === `/api/rifas/${CODIGO_RIFA}/boletos`) {
      const r = this.rifa();
      return json({ codigoRifa: CODIGO_RIFA, cantidad: N, digitos: 2, estados: this.estados.join(''), libres: r.disponibilidad.disponibles,
        reservados: r.disponibilidad.reservados, vendidos: r.disponibilidad.vendidos, generadaEn: new Date().toISOString() });
    }
    if (m === 'GET' && ruta === `/api/rifas/${CODIGO_RIFA}/ganadores`) {
      return json(this.sorteada ? [{ codigoRifa: CODIGO_RIFA, tituloRifa: 'Moto 0 km', posicionPremio: 1, premio: 'Moto',
        numeroBoleto: this.numeroGanador, publicado: true, creadoEn: new Date().toISOString() }] : []);
    }
    if (m === 'POST' && ruta === '/api/publico/reservas') {
      const cuerpo = req.postDataJSON() as { numeros: number[]; nombre: string; telefono: string };
      if (cuerpo.numeros.some((n) => this.estados[n] !== 'L')) {
        return json({ fecha: new Date().toISOString(), estado: 409, error: 'Conflicto', mensaje: 'Un número ya no está disponible.', ruta }, 409);
      }
      cuerpo.numeros.forEach((n) => (this.estados[n] = 'R'));
      this.compra = { estado: 'PENDIENTE', numeros: cuerpo.numeros, nombre: cuerpo.nombre, telefono: `+57${cuerpo.telefono}`.replace('+57+57', '+57') };
      return json(this.reserva(), 201);
    }
    if (m === 'GET' && ruta === `/api/publico/reservas/${CODIGO_RESERVA}` && this.compra) return json(this.reserva());

    if (m === 'POST' && ruta === '/api/auth/login') {
      return json({ tipo: 'Bearer', accessToken: 'token-e2e', refreshToken: 'refresh-e2e', expiraEnSegundos: 900,
        usuario: { id: 1, nombre: 'Administrador', apellido: 'Sistema', correo: 'admin@alexrifas.local', rol: 'ADMIN' } });
    }
    if (m === 'GET' && ruta === '/api/admin/compras') {
      const estado = url.searchParams.get('estado');
      const lista = this.compra && (!estado || estado === this.compra.estado) ? [this.compraAdmin()] : [];
      return json({ contenido: lista, pagina: 0, tamano: 20, totalElementos: lista.length, totalPaginas: lista.length ? 1 : 0 });
    }
    if (m === 'POST' && ruta === `/api/admin/compras/${CODIGO_RESERVA}/confirmar-pago-manual` && this.compra) {
      this.compra.estado = 'CONFIRMADA';
      this.compra.numeros.forEach((n) => (this.estados[n] = 'V'));
      return json({ codigoCompra: CODIGO_RESERVA, estado: 'CONFIRMADA', referenciaPago: 'MANUAL-1', confirmadoEn: new Date().toISOString() });
    }
    // Cualquier otra llamada del panel (resumen, rifas…) responde vacío para no romper la navegación.
    if (m === 'GET') return json({ contenido: [], pagina: 0, tamano: 20, totalElementos: 0, totalPaginas: 0 });
    return json({}, 200);
  }
}
