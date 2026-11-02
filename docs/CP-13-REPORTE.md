# CP-13 · Grilla de números + carrito flotante

**Nota de plan:** el CP-10 se omitió por decisión del dueño del proyecto.

## Qué hay (todo archivo nuevo; no se modifica ninguno existente)
| Pieza | Dónde |
|---|---|
| Carrito (signals): selección ordenada, total, máximo por reserva, persistencia en `sessionStorage`, `reconciliar` | `src/app/core/carrito.ts` |
| Grilla por bloques de 100 (libre / tu selección / reservado / vendido), selector de bloque, "Ir al número", teclado | `src/app/shared/grilla-numeros.ts` |
| Barra flotante: fichas quitables, total en COP, Vaciar, Reservar → `/rifa/:codigo/reservar` | `src/app/shared/carrito-flotante.ts` |
| Contenedor: pide `GET /api/rifas/{codigo}/boletos`, refresca cada 10 s, conecta grilla y carrito | `src/app/shared/grilla-rifa.ts` |

## Integración (en la página de detalle del CP-12)
```ts
import { GrillaRifa } from '../shared/grilla-rifa';   // ajustar ruta; añadir a `imports`
```
```html
<app-grilla-rifa [rifa]="rifa" />   <!-- `rifa` = RifaDetalle ya cargado -->
```

## Reglas de negocio respetadas
- Solo `PUBLICADA` permite elegir; `CERRADA`/`SORTEADA` se ven en solo lectura y vacían el carrito.
- Máximo = `maximoBoletosPorCompra` (aviso al superarlo; se puede quitar estando lleno).
- Ceros a la izquierda según `digitos` (ADR-06).
- Si otra persona toma un número elegido, el refresco lo saca de la selección y lo avisa (`role=status`).
- El carrito se vacía al cambiar de rifa; lo guardado se valida contra la grilla real.
- No se consulta con la pestaña oculta (cuida las horas del servidor gratuito); se consulta al volver.
- `exhaustMap`: con el servidor despertando (~1 min) la petición en curso no se cancela ni se apila.
- Si falla un refresco se conserva la última grilla; si nunca cargó, botón "Reintentar".
- Solo se pintan 100 casillas a la vez (rifas de 1000/10 000 sin lentitud).

## Accesibilidad
Una sola casilla en el orden de Tab; flechas, Inicio/Fin, RePág/AvPág; Enter/Espacio eligen; etiquetas "Número 042, libre/vendido…"; estados distinguibles sin depender del color; objetivos ≥ 44 px.

## Verificación hecha
- `ng test`: 50 tests pasan (13 previos + 37 nuevos).
- `ng build` de producción: OK (~22 kB sin comprimir en chunk perezoso).
- Chromium real + API simulada (1000 números): capturas claro y móvil 390 px revisadas; oscuro generado pero no revisado; ↓ (+10) y RePág (+100) verificados.

## Pendiente / no verificado
- **No integrado en la página del CP-12** (en GitHub el cliente llega solo a `cp11`).
- Probado contra API simulada, no contra el backend real.
- Sin prueba con lector de pantalla real.
- `formatearDinero` puede duplicar un formateador del CP-12: unificar si existe.
