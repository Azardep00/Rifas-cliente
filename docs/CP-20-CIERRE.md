# CP-20 · Cierre (frontend + guía de despliegue)

El CP-20 ya existía en gran parte (perfil prod, CI con humo contra Postgres real, render.yaml, aviso «servidor despertando»).
Este cierre completa lo que los reportes daban por hecho pero **no estaba en los zips**:

- `vercel.json`: headers de seguridad (CSP sin `unsafe-inline` en scripts, HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy,
  Permissions-Policy, COOP). Se conservan los rewrites.
- `angular.json` (producción): `inlineCritical:false` y `fonts:false`; con el CSS crítico en línea la CSP dejaba la app sin estilos.
- `ci.yml`: job `e2e` (Playwright, Pixel 5 + escritorio) y `e2e/package-lock.json` + `.gitignore` (ya se usa `npm ci`).
- Backend: `docs/DESPLIEGUE.md` (Postgres externo → Render → Vercel → comprobación → cold start → respaldos) y `PerfilProdTest`.

## Verificado aquí
- `ng build` producción sin `onload` inline; `ng test` 179/179.
- **e2e ejecutado de verdad** con Chromium: 4/4 (flujo reservar → confirmar → ganador y número ocupado; móvil y escritorio),
  cero violaciones de CSP y cero scroll horizontal. Prueba de rotura: quitar `'unsafe-inline'` de `style-src` hace fallar el e2e.
- `PerfilProdTest`: sus valores esperados se contrastaron contra `application-prod.yml` con un parser YAML, pero **no se ejecutó en Maven**.

## No verificado
- Maven no pudo bajar dependencias en mi entorno: `mvn verify` y el job `humo-postgres` solo los confirma tu CI.
- Nada se desplegó: faltan la base externa, Render, el host real en `vercel.json` y la prueba en el celular (ver DESPLIEGUE.md §4).
