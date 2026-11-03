# CP-20 · Producción (backend)

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay
- **Arreglo previo:** `LoteriaService.java` no tenía `listarActivasParaGestor` (CP-17), que usan `OrganizadorLoteriaController` y `LoteriaServiceGestorTest`; el método solo estaba en `LoteriaService copy.java`. Este zip trae `LoteriaService.java` corregido. **Borra a mano `LoteriaService copy.java`** (un zip no puede borrar archivos): es una clase pública duplicada y no compila.
- `application-prod.yml`: sin valores por omisión para `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` ni `JWT_SECRET` (si faltan, la API no arranca); `PORT` del host; Swagger apagado; sin stacktraces; solo `/actuator/health`; pool pequeño y tolerante a BD que despierta; Redis **opcional** (timeouts de 2 s, su health check desactivado por omisión); `ANTIABUSO_SALTOS_PROXY=2`.
- `PerfilProdTest`: bloquea en CI que alguien reintroduzca un secreto por omisión o reactive Swagger.
- `.github/workflows/ci.yml`: job `test` (`mvn verify`, JDK 21) y job `humo-postgres`: levanta Postgres 16 y Redis 7 reales, arranca el `.jar` con perfil prod y comprueba health UP (⇒ Flyway V1–V4 y `ddl-auto=validate` contra Postgres real), `GET /api/rifas`, login del admin inicial y que Swagger no esté expuesto. Cierra la brecha n.º 6 del plan.
- `render.yaml` (Blueprint, plan free, Docker), `.env.prod.example` y `docs/DESPLIEGUE.md` (Postgres externo → Render → Vercel).

## Verificación
**NADA compilado ni ejecutado**: sin red, Maven ni dependencias. Solo validé la sintaxis YAML de los 3 archivos de configuración. La primera ejecución real es el CI de GitHub: si `humo-postgres` falla, el log de la API se imprime al final.

## Pendiente / riesgos
- Falta un valor real de `DB_URL` y crear el Postgres externo (yo no puedo).
- `ANTIABUSO_SALTOS_PROXY=2` es mi estimación de la cadena Vercel → Render; verifícalo con una reserva real (ver `DESPLIEGUE.md` §5).
- CP-21 (headers/CSP, e2e) sigue pendiente.
