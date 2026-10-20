# backend

API y lógica de servidor (Bun + TypeScript).

Pendiente: inicializar con `bun init` cuando lleguen los requerimientos y se defina el contrato de la API (REST, WebSocket, etc.).

Hasta que eso ocurra, esta carpeta está intencionalmente vacía.

## Arquitectura

**Monolito modular con patrón MVC por módulo.**

Un único proceso Bun que corre toda la API, pero el código está dividido en **módulos independientes por dominio de negocio** (un módulo = una capacidad del producto, no una capa técnica). Cada módulo es autocontenido: tiene su propio controller, modelo, vistas/serializadores, servicios y rutas. Los módulos solo se comunican por sus interfaces públicas, nunca tocándose archivos internos entre sí.

### Por qué este patrón

- **Escalable por partes**: si un módulo crece, se refactoriza o se extrae a servicio sin tocar al resto.
- **Entregable incremental**: un módulo incompleto no bloquea al resto. Se agrega, se saca o se deshabilita a nivel de registro de rutas.
- **Simple de operar**: un solo proceso, un solo deploy, una sola base de datos (al principio) — sin la complejidad operativa de microservicios.
- **MVC conocido**: cada carpeta sigue la misma forma, baja la curva para sumar gente.

### Layout propuesto

```
backend/
├── src/
│   ├── server.ts              # Bun.serve + composición de módulos
│   ├── config/                # env, logger, conexiones DB
│   ├── shared/                # tipos, utilidades y middleware comunes (sin lógica de negocio)
│   └── modules/
│       ├── <modulo>/
│       │   ├── <modulo>.routes.ts        # declaración de rutas del módulo
│       │   ├── <modulo>.controller.ts    # HTTP in/out: parsea request, llama al service, devuelve response
│       │   ├── <modulo>.service.ts       # lógica de negocio pura (sin HTTP)
│       │   ├── <modulo>.model.ts         # entidad + acceso a datos (bun:sqlite / Bun.sql)
│       │   ├── <modulo>.view.ts          # serializadores (DTOs de salida)
│       │   ├── <modulo>.schema.ts        # validación de entrada (ej. Zod)
│       │   ├── index.ts                  # API pública del módulo (lo que exporta al resto)
│       │   └── *.test.ts                 # unit tests junto al código
│       └── <otro-modulo>/...
└── tests/                     # tests de integración entre módulos (opcional, también pueden vivir en /tests raíz)
```

### Reglas de módulo

1. **Un módulo = una responsabilidad de negocio.** Ejemplos tentativos: `auth`, `rooms`, `bookings`, `payments`, `notifications`. Nombres en inglés, singular o plural consistente dentro del repo.
2. **Importaciones hacia afuera solo vía `index.ts`.** Nada de `import ... from "../rooms/rooms.service"`. Si otro módulo necesita algo, se exporta explícitamente desde `index.ts`.
3. **El controller no tiene lógica de negocio.** Solo traduce HTTP ↔ service. La lógica va en el service.
4. **El model es el único que toca la base.** Services llaman al model, nunca a la DB directo.
5. **La view/DTO decide qué sale.** Nunca se devuelve una entidad del model crudo; siempre pasa por un serializador.
6. **Cada módulo registra sus propias rutas** en `*.routes.ts` y `server.ts` solo las compone.

### Agregar o remover un módulo

- **Agregar**: crear la carpeta siguiendo el layout, exportar sus rutas desde `index.ts`, montar en `server.ts`.
- **Deshabilitar temporalmente**: comentar el registro de rutas en `server.ts`. El resto del sistema sigue funcionando.
- **Remover**: borrar la carpeta y la línea de registro. Al no haber imports cruzados por archivos internos, no quedan referencias colgadas (si están, el type-checker las marca).

## Convenciones

- Runtime: **Bun** (no Node.js). Server con `Bun.serve()`.
- SQLite: `bun:sqlite`. Postgres: `Bun.sql`. Redis: `Bun.redis`.
- Tests: `bun test`. Convención `*.unit.test.ts` / `*.integration.test.ts` (los workflows filtran por substring).
- Variables de entorno: Bun carga `.env` automáticamente (no usar `dotenv`).
