# CP-15 · Mis boletos + Resultados y ganadores

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay
| Pieza | Dónde |
|---|---|
| `/mis-boletos`: consulta por código + celular (la API no permite buscar solo por celular), validación igual a la API, botón bloqueado mientras consulta, mensajes 404/429/sin conexión de la API, y lista «En este dispositivo» con Quitar | `pages/mis-boletos.ts` (+ spec) |
| `/resultados/:codigo`: ganadores por premio con ceros a la izquierda, explicación del método de sorteo y de la regla de cupo vacío (ADR-07) | `pages/resultados.ts` (+ spec) |
| `reservasGuardadas()` y `olvidarReserva()` | `core/reservas-locales.ts` (+ spec) |
| Rutas reales; **se elimina** `pages/pendiente.ts` (provisional desde el CP-11) | `app.routes.ts` |

## Reglas de negocio respetadas
- La API solo devuelve ganadores con la rifa `SORTEADA` (antes responde 404): la pantalla no los pide si la rifa no está sorteada y trata ese 404 como «aún no publicado», no como error.
- Solo se muestran ganadores con `publicado = true`.
- Rifa cerrada/publicada: «Todavía no hay resultados» con la fecha del sorteo; cancelada: lo dice.
- ADR-06: números con ceros según `digitos`. ADR-07: la regla de cupo vacío se muestra junto al resultado.
- El celular completo nunca se muestra; la lista local solo muestra códigos. Quitar no cancela la reserva.

## Verificación hecha
- `ng test`: **132 tests** pasan (108 previos + 24 nuevos).
- Chromium real + API simulada, 13 comprobaciones OK (3 corridas), escritorio, móvil 390 px y oscuro, sin errores de consola.
- Defecto encontrado en capturas y corregido: el código de 32 caracteres partía «Reserv-a» en la lista local.

- Prueba de rotura: 15 defectos introducidos a propósito en `mis-boletos`, `resultados` y `reservas-locales` (consultas dobles, celular sin normalizar, ganadores sin publicar, sin orden por premio, 404 de ganadores tratado como error, números sin ceros, regla de cupo vacío mal descrita, etc.). Se detectaron 14 de entrada; sobrevivió «acepta códigos de 1 carácter» (nadie probaba el largo mínimo). Se añadió el test y ahora se detectan también las variantes de 1 y 5 caracteres. Archivos restaurados y comparados byte a byte después.

## Incidente de proceso (para que lo sepas)
Una primera corrida de mutaciones se solapó con corridas de tests y dejó una mutación en un zip intermedio (`cp15-parcial.zip`). Lo detecté al comparar el zip con el código fuente; **descarta ese zip**. La prueba de rotura final se hizo sola, en primer plano.

## Pendiente / no verificado
- Probado con API simulada, no contra el backend levantado.
- Sin lector de pantalla real.
- El «número mayor» de la lotería no se muestra: la API pública no lo expone.
- Rutas `/admin/**` llegan en el CP-16.
