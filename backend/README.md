# Backend de Room_Link

API construida con **Hono**, **TypeScript**, **Drizzle ORM** y **MySQL 8**. Implementa una arquitectura de **Monolito Modular con MVC** fundamentada en **Domain-Driven Design (DDD)** con una única capa de dominio compartida.

---

## 1. Arquitectura: Monolito Modular con MVC y DDD

Para mantener alta cohesión y bajo acoplamiento:
1. **Un solo Dominio (`src/domain/`)**: Las entidades del negocio (`User`, `Profile`, `RoomListing`, `Application`, `CompatibilityProfile`) y las interfaces de los repositorios (`IUserRepository`, etc.) viven aquí. No conocen nada de bases de datos, SQL ni HTTP.
2. **Módulos con MVC independiente (`src/modules/`)**:
   - Cada módulo (`auth`, `profile`, `rooms`, `applications`) tiene:
     - `*.controller.ts` (Controlador HTTP): Lee la petición, valida la entrada y delega al servicio.
     - `*.service.ts` (Servicio de Aplicación): Coordina los casos de uso y lógica del negocio.
     - `*.view.ts` (Vista / Serializador DTO): Decide qué datos salen al cliente, protegiendo campos privados (como hashes de contraseña).
     - `*.routes.ts`: Define las rutas de ese módulo.
     - `index.ts`: Expone las rutas hacia el resto de la aplicación.
3. **Infraestructura (`src/infrastructure/` y `src/db/`)**:
   - `src/db/schema/`: Modelos declarativos de Drizzle ORM que representan las tablas MySQL.
   - `src/infrastructure/repositories/`: Implementaciones concretas de los repositorios usando Drizzle (`DrizzleUserRepository`, `DrizzleRoomListingRepository`, etc.).

```text
backend/
├── src/
│   ├── app.ts                         # Composición de módulos y servidor Hono
│   ├── server.ts                      # Punto de entrada HTTP (un solo servidor)
│   ├── config.ts                      # Variables de entorno y configuración
│   ├── domain/                        # CAPA DE DOMINIO ÚNICA (DDD)
│   │   ├── entities/                  # User, Profile, RoomListing, Application, Compatibility
│   │   ├── repositories/              # Interfaces (IUserRepository, IRoomListingRepository...)
│   │   └── index.ts
│   ├── modules/                       # MÓDULOS MODULARES CON MVC
│   │   ├── auth/                      # Controller, Service, View, Routes
│   │   ├── profile/                   # Controller, Service, View, Routes
│   │   ├── rooms/                     # Controller, Service, View, Routes
│   │   └── applications/              # Controller, Service, View, Routes
│   ├── infrastructure/
│   │   └── repositories/              # Implementaciones con Drizzle ORM
│   └── db/
│       ├── client.ts                  # Cliente db Drizzle y pool mysql2
│       ├── migrate.ts                 # Script ejecutor de migraciones
│       └── schema/                    # Tablas Drizzle MySQL
├── tests/
│   ├── unit/                          # Pruebas unitarias de dominio, módulos y app
│   └── integration/                   # Pruebas de integración con MySQL
├── drizzle/                           # Migraciones SQL generadas por Drizzle
├── Dockerfile                         # Imagen Docker del servicio backend
└── drizzle.config.ts                  # Configuración de migraciones Drizzle
```

---

## 2. Aclaraciones: Servidores, Dockers y Archivos de Configuración

### ¿Por qué parecía haber 2 servidores?
- **Un solo servidor**: En el código sólo existe **un único servidor HTTP**, iniciado en `src/server.ts`.
- **`app.ts` vs `server.ts`**: `app.ts` define la aplicación Hono y registra las rutas (útil para hacer pruebas unitarias sin abrir puertos). `server.ts` es el ejecutable que escucha peticiones en el puerto asignado (por defecto `3000`).
- **Scripts duplicados**: La IA anterior había agregado comandos paralelos para Node.js y Bun (`dev:node`, `dev:bun`, etc.). Ahora el flujo está simplificado y estandarizado con `npm run dev`, `npm start`, etc.

### ¿Qué hace cada Docker (`compose.yaml` en raíz vs `backend/Dockerfile`)?
- **`compose.yaml` (en la raíz)**: Es el **orquestador de Docker Compose**. Levanta:
  1. El contenedor con el motor de base de datos **MySQL 8.4** en el puerto `3307`.
  2. Un contenedor temporal que ejecuta automáticamente las migraciones contra MySQL.
- **`backend/Dockerfile` (en `backend/`)**: Es la **receta de construcción de la imagen del backend**. No es un servidor aparte; es el archivo que Docker Compose utiliza para empaquetar y ejecutar la aplicación Node.js en contenedores.

### ¿Para qué son los archivos de configuración en `backend/`?
- **`drizzle.config.ts`**: Le indica a la herramienta CLI de Drizzle (`drizzle-kit`) dónde están los esquemas de tablas (`src/db/schema/index.ts`), dónde guardar las migraciones SQL (`drizzle/`) y las credenciales de conexión.
- **`tsconfig.json`**: Configura las opciones del compilador de TypeScript (`NodeNext`, modo estricto de tipos).
- **`vitest.config.ts`**: Configura el ejecutor de pruebas unitarias y de integración Vitest.
- **`database/bootstrap-local.sql`**: Script SQL auxiliar para desarrolladores que no usan Docker e instalan MySQL nativamente en su computadora.
- **`.dockerignore`**: Evita que `node_modules` o archivos innecesarios de tu máquina local se copien a la imagen Docker.

---

## 3. Inicio Rápido

### Requisitos:
1. Node.js (versión 20 o superior).
2. Levantar la base de datos MySQL (con Docker Compose en la raíz: `docker compose up -d`).

### Comandos de Desarrollo:

```bash
# 1. Instalar dependencias
npm install

# 2. Aplicar migraciones a MySQL
npm run db:migrate

# 3. Iniciar el servidor en modo desarrollo (recarga automática)
npm run dev
```

La API estará disponible en `http://localhost:3000`.

---

## 4. Comandos de la Aplicación

| Comando | Acción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente (`watch`). |
| `npm start` | Inicia el servidor en producción. |
| `npm run build` | Compila TypeScript a JavaScript. |
| `npm run typecheck` | Comprueba tipos de TypeScript sin emitir archivos. |
| `npm test` | Ejecuta la suite de pruebas unitarias y de integración. |
| `npm run test:unit` | Ejecuta únicamente las pruebas unitarias rápidas. |
| `npm run db:generate` | Genera nuevas migraciones SQL en `drizzle/` si cambias los esquemas. |
| `npm run db:migrate` | Aplica las migraciones SQL a MySQL. |
| `npm run db:check` | Comprueba consistencia en migraciones Drizzle. |
| `npm run db:studio` | **Drizzle Studio**: Abre el gestor visual de base de datos en `https://local.drizzle.studio`. |

---

## 5. Documentación de Drizzle ORM

Para aprender a realizar consultas (`select`), inserciones (`insert`), actualizaciones (`update`), joins y transacciones con Drizzle ORM, consulta:
👉 **[Guía Completa de Drizzle ORM](../docs/drizzle-guide.md)**.
