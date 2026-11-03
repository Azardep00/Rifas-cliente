# CP-16 (PARCIAL) · Login admin, guards por rol, interceptor JWT + refresh, layout /admin

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay
- `core/auth/sesion.ts`: sesión (signals), login, refresh compartido (una sola petición aunque haya varios 401; el refresh token rota), logout, persistencia en localStorage con try/catch.
- `core/auth/auth.interceptor.ts`: Bearer solo en `/api/admin/**` y `/api/organizador/**`; ante 401 un refresh y reintento; si falla, sesión cerrada y login.
- `core/auth/guards.ts`: `panelMatch` (canMatch: ADMIN u ORGANIZADOR; sin sesión -> login con `volver`; CLIENTE -> inicio) y `soloSinSesionGuard`.
- `admin/login.ts` (mobile-first, campos 16 px, botón ver/ocultar), `admin/layout.ts` (barra superior + navegación inferior táctil, safe-area), `admin/resumen.ts`.
- `app.ts` oculta cabecera/pie públicos dentro de `/admin`. `app.config.ts` registra el interceptor.
- Un CLIENTE que inicie sesión es rechazado y su refresh token se revoca.

## NO verificado (importante)
El entorno no pudo instalar dependencias (sin acceso a npm). **No corrí `ng build` ni `ng test`.** Los specs nuevos están escritos pero sin ejecutar. Corre `npm ci && npm test && npm run build` y avísame de cualquier error.
Backend: sin cambios. `/api/admin/**` exige ROLE_ADMIN; el ORGANIZADOR usa `/api/organizador/**`.
