# CP-12 · Portada y detalle de rifa

## Qué hay
| Pantalla / pieza | Dónde | Notas |
|---|---|---|
| Portada `/`: rifas abiertas como boletos (precio en el talón, título, fecha de sorteo, avance), "Ver más rifas" (paginación de 12) | `pages/inicio.ts` | Estados: cargando, error con reintento, vacío |
| Detalle `/rifa/:codigo`: premios, cómo se decide el ganador, panel con precio, avance, fechas, máximo por compra y organizador | `pages/detalle.ts` | Título de la pestaña = título de la rifa |
| **Regla de cupo vacío visible antes de comprar (ADR-07)**, en texto llano y fiel al CP-09 | `detalle.ts` (`REGLAS`) | Solo en rifas por lotería |
| Botón según estado: `PUBLICADA` → "Escoger números" (`/rifa/:codigo/reservar`); `SORTEADA` → "Ver resultados"; cerrada/cancelada → aviso, sin botón | `detalle.ts` | La reserva dura `reservaMinutos` (se muestra en horas/minutos) |
| `AvisoCarga`: cargando, aviso "el servidor está despertando" si tarda más de 4 s (cold start), error con reintento (sin reintento en 404) | `shared/aviso-carga.ts` | Reutilizable en CP-13 a CP-15 |
| `Progreso`: barra accesible (`role=progressbar`) | `shared/progreso.ts` | Cuenta números no libres (vendidos + reservados), igual que la grilla |
| Formato Colombia: COP sin decimales, fechas en hora de Bogotá, duración, miles con punto | `core/formato.ts` | |

## Verificación hecha
- `ng build` OK; `ng test`: **33 tests** pasan (formato, `Inicio`, `Detalle`, más los del CP-11).
- Mutación: cambiar el cálculo del porcentaje y anular el texto de la regla hizo fallar 5 tests.
- Capturas con API simulada (Playwright) en claro, oscuro y móvil 390 px; corregí un precio que se partía y la fecha demasiado larga de las tarjetas.

## Pendiente / no verificado
- **Nunca corrió contra la API real** (no hay backend levantado aquí). Los datos de las pruebas y capturas son simulados a partir de los DTO `RifaResumen` / `RifaDetalle`. Primera tarea cuando levantes el stack: abrir `/` y `/rifa/<codigo>` con `npm start` y una rifa publicada.
- `imagenUrl` se pinta tal cual viene; cuando exista CSP (CP-21) habrá que permitir el dominio de las imágenes.
- La portada solo muestra rifas que devuelva `GET /api/rifas`; si esa consulta incluye estados no publicados lo veremos en la prueba real.
- El botón "Escoger números" lleva por ahora a la pantalla provisional (CP-14); la grilla del CP-13 irá dentro de este detalle.
