# CP-11 · Scaffold de Angular

**Nota de plan:** el **CP-10 (ingesta automática de loterías) se omitió por decisión del dueño del proyecto**. Los resultados siguen cargándose a mano (CP-08). Con este CP empieza el frontend.

## Qué hay
Carpeta nueva `frontend/` (Angular 22, standalone, signals, zoneless, rutas perezosas).

| Pieza | Dónde |
|---|---|
| Rutas públicas del plan (`/`, `rifa/:codigo`, `rifa/:codigo/reservar`, `reserva/:codigo`, `mis-boletos`, `resultados/:codigo`, `**`) | `src/app/app.routes.ts` (las de CP-12 a CP-15 muestran una pantalla provisional) |
| Cliente tipado de la API pública (rifas, detalle, grilla, ganadores, reservar, consultar reserva) | `src/app/core/api/` |
| Errores: `ApiError` con mensaje de la API, `Retry-After` del 429 y `sinConexion` (servidor dormido) | `core/api/api-error.ts` |
| Utilidades de boletos: ceros a la izquierda (ADR-06), decodificar `estados` L/R/V, 10^dígitos | `core/boletos.ts` |
| Tokens de diseño (claro/oscuro), fuentes autoalojadas, foco visible, `prefers-reduced-motion` | `src/styles.css`, `angular.json` |
| Cabecera, pie ("demostración"), enlace "saltar al contenido", portada con el motivo del boleto | `layout/`, `pages/inicio.ts` |
| Dev: `/api` → `localhost:8080` | `proxy.conf.json` |
| Producción: rewrite `/api/*` a la API y fallback SPA (ADR-03) | `vercel.json` |

Se modificó `.dockerignore` (+`frontend`) para que el `docker build` de la API no copie el frontend.

## Verificación hecha
- `ng build` (producción): OK, 254 kB iniciales (68 kB transferidos).
- `ng test`: 13 tests pasan (boletos, `ApiService` con `HttpTestingController`, errores 429/red, rutas y shell).
- Capturas de la portada en claro, oscuro y móvil (390 px) revisadas.

## Pendiente / no verificado
- **Deploy en Vercel no probado** (el criterio del plan lo pide): falta reemplazar `REEMPLAZAR-HOST-DE-LA-API.example.com` en `vercel.json` y configurar el proyecto con *Root Directory* = `frontend`.
- **Cliente OpenAPI (ADR-09):** los modelos están escritos a mano desde los DTO Java, no generados; no pude levantar la API aquí. Si cambia un DTO hay que actualizar `models.ts`.
- **Contrato sin probar contra la API real.** Un detalle a confirmar en el CP-12: `Jackson non_null` omite campos nulos, por eso los opcionales son `?`.
- Pantalla provisional `pendiente.ts`: se borra cuando existan las pantallas reales.
