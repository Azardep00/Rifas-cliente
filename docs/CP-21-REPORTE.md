# CP-21 · Hardening, e2e y respaldos (frontend, mobile-first)

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay
- `vercel.json`: headers de seguridad en todas las rutas: CSP (`script-src 'self'`, sin inline en scripts; `style-src` con `'unsafe-inline'` porque Angular inyecta estilos de componente; `frame-ancestors 'none'`), HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP. Se conservan los `rewrites` del CP-20.
- `angular.json` (producción): `inlineCritical: false` y `fonts: false`. Angular inyecta el CSS crítico con un `onload` inline que la CSP bloquearía (la hoja se quedaría en `media="print"` y la app se vería sin estilos).
- `e2e/` (Playwright, **proyecto aparte**, no toca el `package.json` raíz): corre el build de producción con un servidor propio que **aplica los headers de `vercel.json`**, con la API simulada en el navegador (determinista, sin backend). Flujo: home → detalle → elegir 07 y 12 → reservar → pantalla con cuenta regresiva → admin: login → cola de pagos → confirmar con Nequi → la persona ve su reserva confirmada → resultados muestran el ganador `07`. También comprueba **cero violaciones de CSP** y **cero scroll horizontal** en cada pantalla clave. Se ejecuta en **Pixel 5** (principal) y escritorio.
- CI: nuevo job `e2e` (reusa el build del job `build`; informe HTML como artefacto si falla).

## Verificación
**NADA compilado ni ejecutado** (sin red, `node_modules` ni navegador). Los selectores salen de leer las plantillas, pero es la parte con más riesgo de ajuste al primer corrido: ejecuta `npm run build`, luego en `e2e/`: `npm install && npx playwright install chromium && npx playwright test`, y compárteme el error si algo falla.

## Límites / pendiente
- El sorteo se simula (`api.sortear()`): la pantalla de sorteo (CP-19) no está recorrida en este e2e.
- La API es simulada: no prueba el contrato real. Un e2e contra el backend real (Docker Compose) queda como mejora.
- `e2e/` no tiene lockfile (no pude generarlo sin red): corre `npm install` en `e2e/` y haz commit de `package-lock.json`; luego cambia `npm install` por `npm ci` en el workflow.
- Los headers solo se pueden verificar de verdad en el deploy de Vercel (revisa la consola del navegador en producción).
