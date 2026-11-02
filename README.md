# Alex Rifas · Frontend (Angular)

Una sola SPA para la cara pública y, desde el CP-16, `/admin`. Angular 22, componentes standalone, zoneless.

```bash
cd frontend
npm ci
npm start          # http://localhost:4200, /api -> http://localhost:8080 (proxy.conf.json)
npm test           # Vitest (ng test)
npm run build      # dist/frontend/browser
```

- **Mismo origen (ADR-03):** en desarrollo `proxy.conf.json`; en producción el rewrite de `vercel.json`.
  Antes de desplegar, reemplaza `REEMPLAZAR-HOST-DE-LA-API.example.com` en `vercel.json`.
- **Cliente de API:** `src/app/core/api/` (modelos espejo de los DTO, `ApiService`, interceptor de errores).
- **Diseño:** tokens en `src/styles.css` (claro/oscuro automático). Fuentes autoalojadas (`@fontsource-variable`), sin CDN.
- **Rutas:** `src/app/app.routes.ts`, todas perezosas.
