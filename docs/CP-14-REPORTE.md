# CP-14 · Checkout invitado + pantalla de reserva

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay
| Pieza | Dónde |
|---|---|
| Grilla integrada en el detalle; «Escoger números» lleva a `#numeros` | `pages/detalle.ts` (+ spec) |
| Checkout `/rifa/:codigo/reservar`: nombre + celular, validación igual a la API, botón bloqueado mientras envía, errores 409/429 con el mensaje de la API | `pages/reservar.ts` (+ spec) |
| Reserva `/reserva/:codigo`: cuenta regresiva, sondeo cada 15 s (solo pestaña visible), cambia sola a «Pago confirmado», instrucciones de pago, WhatsApp, pide el celular si no está guardado | `pages/reserva.ts` (+ spec) |
| Celular colombiano (mismas reglas que `TelefonoColombia.normalizar`) y nombre | `core/telefono.ts` (+ spec) |
| Cuenta regresiva (redondea hacia arriba; no marca 00:00 antes de tiempo) | `core/cuenta-regresiva.ts` (+ spec) |
| Celular de la reserva recordado en el navegador | `core/reservas-locales.ts` (+ spec) |
| Número de WhatsApp del organizador | `core/config-pago.ts` |
| Carrito y barra flotante usan `formatearMoneda` de `formato.ts` (se quitó el formateador duplicado) | `core/carrito.ts`, `shared/carrito-flotante.ts` |
| `anchorScrolling` para el fragmento `#numeros` | `app.config.ts`, `app.routes.ts` |

## Contrato con la API (verificado contra el código del backend)
`POST /api/publico/reservas` y `GET /api/publico/reservas/{codigo}?telefono=` coinciden con `ReservaPublicaRequest` / `ReservaPublicaResponse` (`CompraDtos.java`). El teléfono se envía normalizado a 10 dígitos; la API lo vuelve a validar.

## Reglas de negocio respetadas
- Sin cuenta (ADR-04): solo nombre + celular; acceso a la reserva por código + celular.
- Reserva solo en rifas `PUBLICADA`; el plazo mostrado sale de `reservaMinutos` de la rifa.
- Máquina de estados: PENDIENTE (reloj + cómo pagar) → CONFIRMADA / EXPIRADA / CANCELADA (sin reloj y con salida «Escoger números de nuevo»).
- Antiabuso (ADR-05): un 429 se muestra tal cual, sin reintentos automáticos.
- Un doble clic no crea dos reservas.
- Pago manual: la pantalla no promete pago en línea; el cambio a «Pago confirmado» ocurre cuando el admin confirma.
- Se muestra el celular enmascarado que devuelve la API, nunca el completo.

## Verificación hecha
- `ng test`: **108 tests** pasan.
- `ng build` de producción: OK. Inicial 276 kB (75 kB comprimido); `reservar` 10 kB y `reserva` 13 kB perezosos.
- Chromium real + API simulada, 11 comprobaciones OK, escritorio, móvil 390 px y oscuro, sin errores de consola:
  errores del formulario vacío, rechazo de celular que no empieza por 3, doble clic = 1 POST, POST normalizado,
  cuenta regresiva, paso automático a «Pago confirmado» a los 15 s, petición del celular cuando no está guardado.
- Prueba de rotura: 13 defectos introducidos a propósito en reservar, reserva, telefono, cuenta-regresiva y config-pago.
  10 se detectaron de entrada. 3 sobrevivieron (nombre de 1 letra, rifa no publicada con números guardados, intervalo
  de sondeo); se escribieron tests nuevos y ahora se detectan los 3. Los archivos se restauraron después de cada prueba.
- Defecto encontrado en las capturas y corregido: «8:10 p. m..» (doble punto) en «Vence el…»; con test de regresión.

## Pendiente / no verificado
- **Tú:** poner el WhatsApp del organizador en `core/config-pago.ts` (formato `573001234567`). Vacío = el botón no aparece.
  Con número, el enlace está cubierto por tests, pero no lo abrí en un navegador real.
- Probado contra API simulada, no contra el backend levantado.
- Las instrucciones de pago son genéricas (no hay datos bancarios): el organizador coordina por WhatsApp/llamada.
- Sin prueba con lector de pantalla real.
- La hora de vencimiento se muestra en la zona horaria del navegador.
