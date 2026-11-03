# CP-19 · Sorteo en UI (mobile-first)

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto. **Solo frontend**: el backend (CP-09) ya expone todo lo necesario.

## Qué hay
- `/admin/sorteo` (`admin/sorteo-lista.ts`): rifas por lotería, las que esperan sorteo primero. Ventas abiertas → "Cerrar ventas" (confirmación dentro de la tarjeta); cerradas → "Preparar sorteo"; sorteadas → enlace a `/resultados/:codigo`. Avisa si hay reservas sin pagar (la API bloquea el sorteo en ese caso).
- `/admin/sorteo/:id` (`admin/sorteo.ts`): previsualiza (no guarda nada), muestra un paso por premio con su color (directo / cupo vacío adjudicado / repetido), ganadores, y resultados `PENDIENTE_VERIFICACION` con botón "Verificar" que vuelve a previsualizar. "Ejecutar sorteo" solo se habilita con el plan completo y pide confirmación en la página; al terminar muestra ganadores y enlaza a resultados. Ante un 409 recarga la previsualización.
- `admin/sorteo-texto.ts` (+ spec): textos y colores de cada paso; `diaLoteria` evita que la fecha sin hora retroceda un día por zona horaria.
- `AdminApi`: `cerrar`, `previsualizarSorteo`, `ejecutarSorteo`, `resultadosLoteria`, `verificarResultado`; tipos nuevos en `models.ts`.
- Pestaña "Sorteo" solo ADMIN (la API de sorteo exige ADMIN) y `adminMatch` en las rutas.

## Móvil
Una columna, botones de 56 px, confirmaciones en la misma pantalla (sin modales), color + texto en cada estado, margen para la barra inferior.

## Verificación
**NADA compilado ni probado** (sin `node_modules`, `mvn` ni red). Corre `ng build` y `ng test`. Sin probar contra la API real ni en un celular físico.

## Pendiente / decisiones
- No hay "cargar resultado nuevo" aquí (existe en la API, `POST /api/admin/loterias/{id}/resultados`); solo verificar. Dime si quieres el formulario en el CP-19b.
- `/resultados/:codigo` ya mostraba ganadores publicados (CP-15): el sorteo los publica solo.
