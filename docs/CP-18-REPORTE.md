# CP-18 · Cola de pagos (mobile-first)

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Frontend (Rifas-cliente-main)
- `admin/pagos.ts` (`/admin/pagos`): cola de pagos pensada para celular.
  - Filtros por estado en chips con scroll horizontal: Pendientes (por defecto), Confirmadas, Vencidas, Liberadas, Todas.
  - Un solo buscador: celular válido (con o sin +57) busca por teléfono; hasta 5 dígitos busca por número de boleto (`07` == 7). Al buscar se mira en todos los estados.
  - Tarjeta por reserva: nombre, números (con ceros según las cifras de la rifa), total, cuenta regresiva (rojo si quedan <= 5 min), llamar y WhatsApp (zonas táctiles de 48 px).
  - Confirmar pago: se abre dentro de la tarjeta, método obligatorio (Nequi, Daviplata, Bancolombia, Efectivo, Otro) + nota opcional. Liberar: motivo opcional.
  - Tras actuar se vuelve a pedir la lista al servidor (también ante un 409) y se muestra un aviso. "Cargar más" pagina; "Actualizar" recarga.
- `admin/pagos-busqueda.ts` (+ spec): lógica pura del buscador, teléfono y WhatsApp.
- `AdminApi.compras / confirmarPago / liberar`, tipos nuevos en `models.ts`.
- Pestaña "Pagos" **solo para ADMIN** (la API exige ADMIN) y `adminMatch` en la ruta: un organizador que escriba la URL vuelve al resumen.

## Backend (Alex-Rifas-main)
- `GET /api/admin/compras` acepta `numero`: devuelve las compras que **tienen hoy** ese número. Un boleto liberado/vencido ya no apunta a su compra anterior, por eso esas no aparecen al buscar por número (sí por teléfono).
- `BoletoRepository.findCompraIdsByNumero`, sobrecarga en `AdminCompraService.listar` (la firma anterior se conserva) y test nuevo en `AdminCompraServiceTest`.

## Verificación
- **NADA compilado ni probado**: este entorno no tiene `node_modules` ni `mvn` ni red. Corre `ng build`, `ng test` y `mvn test` antes de integrar.
- No probado contra la API real ni en un celular físico.

## Decisiones a tener en cuenta
- "La grilla se actualiza": la grilla pública se refresca sola (CP-13); aquí se confirma contra el servidor y la tarjeta enlaza a la rifa.
- No hay auto-refresco de la cola (gasta datos móviles); se hace con "Actualizar". Dime si lo quieres cada 30 s.
- El organizador no ve Pagos: si quieres que sí, hay que abrir esos endpoints a ORGANIZADOR en `SecurityConfig` y `exigirAdmin` (decisión de negocio, no la tomé).
