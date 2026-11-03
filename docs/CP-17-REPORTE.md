# CP-17 · Dashboard + wizard de rifa (mobile-first)

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Frontend (Rifas-cliente-main)
- `admin/resumen.ts`: dashboard con 4 cifras (rifas activas, boletos vendidos, recaudo confirmado, reservados ahora), aviso de borradores y tarjetas de rifas activas con barra de progreso. Botón "Nueva rifa" de ancho completo.
- `admin/rifas.ts` (`/admin/rifas`): lista de rifas; los borradores se publican con un toque.
- `admin/rifa-wizard.ts` (`/admin/rifas/nueva`): wizard Datos -> Premios -> Sorteo -> Publicar. Un paso por pantalla, campos de 16 px, teclado numérico, barra de acciones fija sobre la navegación inferior, safe-area.
  - Con método LOTERIA, elegir 2/3/4 cifras fija la cantidad en 10^cifras (ADR-06) y se muestra la regla de cupo vacío (ADR-07).
  - Envío: crear rifa -> premios -> publicar (o solo "Borrador"). Si falla a mitad, la rifa queda en borrador y "Reintentar" continúa sin duplicar premios.
- `admin/rifa-borrador.ts` (+ spec): validaciones que espejan `RifaService`, horas de Colombia (UTC-5) -> ISO.
- `core/api/admin-api.ts` y tipos nuevos en `models.ts`. Rutas y pestaña "Rifas" en el layout.

## Backend (Alex-Rifas-main)
- Nuevo `GET /api/organizador/loterias` (solo lectura, solo activas, ORGANIZADOR o ADMIN): `/api/admin/loterias` es solo ADMIN y el wizard lo necesita.
- `LoteriaService.listarActivasParaGestor` + `LoteriaServiceGestorTest`.

## Verificación
- Frontend: `ng build` OK y `ng test`: 161 tests verdes (21 archivos).
- **Backend NO compilado ni probado:** Maven no pudo resolver dependencias en este entorno. Corre `mvn test` antes de integrar.
- No probado contra la API real ni en un celular físico.

## Decisiones a tener en cuenta
- El dashboard calcula el recaudo como vendidos x precio (COP) con los datos de `RifaGestionDto`; el resumen detallado por rifa (`/api/admin/rifas/{codigo}/resumen`) es solo ADMIN y llega con la cola de pagos (CP-18).
- Descripción de premios e imagen de premios no están en el wizard (el backend los admite): se agregan si los quieres.
