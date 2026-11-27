# Pendiente: consolidar "Explorar" y "Habitaciones" (Grupo 4 de los bugs exploratorios)

**Origen:** pruebas exploratorias (noviembre 2026). El tester notó que "Explorar" y
"Habitaciones" hacen lo mismo (listar habitaciones en renta) y pidió de-duplicar
("redirigir" uno al otro).

## Por qué NO es un simple redirect

No son la misma pantalla con dos URLs: son **dos stacks completos y paralelos**,
con código y páginas de detalle distintas.

| | Explorar | Habitaciones |
|---|---|---|
| Lista | `features/rooms/RoomFeed.jsx` | `features/listings/ListingDirectory.jsx` |
| Ruta lista | `/` y `/explorar` | `/habitaciones` |
| Detalle | `features/rooms/RoomDetail.jsx` | `features/listings/ListingDetail.jsx` |
| Ruta detalle | `/habitacion/:roomId` (singular) | `/habitaciones/:listingId` (plural) |
| Orden | por compatibilidad | catálogo |

Un `Navigate` de `/habitaciones` → `/explorar` deja la lista apuntando a un stack
y los detalles al otro (incoherente), y **rompe el E2E** `web publica con reglas y
costos…` (`frontend/tests/e2e/qa-roles.spec.mjs`), que navega por "Habitaciones" y
usa el detalle `/habitaciones/:id` con su flujo de **mapa + reglas/costos +
postular**. `RoomDetail` (el detalle de Explorar) es una implementación distinta;
habría que confirmar que cubra ese mismo flujo.

## Qué implica hacerlo bien

1. Elegir el stack canónico (p. ej. Explorar/RoomFeed) y verificar que su detalle
   (`RoomDetail` / `/habitacion/:id`) tenga TODO lo del otro: mapa (con tiles Carto),
   reglas y costos, postular, estados.
2. Redirigir el stack retirado (lista **y** detalle) al canónico.
3. Quitar el nav link duplicado.
4. **Migrar el E2E #2** (y cualquier otro que use `/habitaciones`) a las rutas y la
   UI del stack canónico.
5. Verificar en navegador el flujo completo publicar → explorar → detalle → postular.

Es un refactor acotado pero real (toca rutas, un test que pasa y dos detalles), por
eso se dejó para una sesión enfocada en vez de meterlo apurado.

> Nota relacionada: "Recomendados" (feed de afinidad de Omar) también se marcó como
> duplicado de "Buscar roomies", pero **NO** se toca porque la HU-04 (graded) testea
> ese feed; redirigirlo invalidaría esa prueba.
