# Guía de Uso de Drizzle ORM en Room_Link

Esta guía explica en detalle cómo aprovechar al 100% **Drizzle ORM** con **MySQL 8** en Room_Link: su gestor visual integrado (**Drizzle Studio**), la **inferencia automática de tipos (`$inferSelect` y `$inferInsert`)**, consultas tipadas y flujo de migraciones.

---

## 1. ¿Qué es Drizzle ORM y cómo se organiza?

Drizzle es un ORM TypeScript de alto rendimiento que no tiene sobrecarga de tiempo de ejecución y proporciona tipado estático total (`type-safe`).

En este proyecto, la estructura de base de datos se organiza así:

```text
backend/
├── drizzle.config.ts              # Configuración de Drizzle Kit (CLI, Studio y migraciones)
├── drizzle/                       # Archivos SQL generados automáticamente
│   ├── 0000_smooth_titanium_man.sql
│   └── meta/
├── src/
│   └── db/
│       ├── client.ts              # Instancia de conexión (pool mysql2 + db Drizzle)
│       ├── migrate.ts             # Script ejecutor de migraciones
│       └── schema/                # Tablas y tipos inferidos en TypeScript
│           ├── auth.ts            # authUsers, authUserRoles, etc. + tipos AuthUserRow, NewAuthUser
│           ├── profile.ts         # profileProfiles, etc. + tipos ProfileRow, NewProfile
│           ├── rooms.ts           # roomListings, etc. + tipos RoomListingRow, NewRoomListing
│           ├── compatibility.ts   # compatProfiles, etc. + tipos CompatProfileRow, NewCompatProfile
│           ├── social.ts          # appApplications, etc. + tipos AppApplicationRow, NewAppApplication
│           ├── governance.ts      # modReports, etc. + tipos ModReportRow, NewModReport
│           ├── geo.ts             # geoZones, etc. + tipos GeoZoneRow, NewGeoZone
│           ├── core.ts            # coreOutboxEvents + tipos CoreOutboxEventRow, NewCoreOutboxEvent
│           └── index.ts           # Exportación unificada de esquemas y tipos
```

---

## 2. Comandos Principales en `package.json`

Ejecuta estos comandos dentro de la carpeta `backend/`:

| Comando | Acción |
|---|---|
| `npm run db:studio` | **Inicia Drizzle Studio**: gestor visual de base de datos en tu navegador. |
| `npm run db:generate` | Lee los esquemas en `src/db/schema/` y genera nuevos archivos `.sql` en `drizzle/`. |
| `npm run db:migrate` | Aplica las migraciones SQL pendientes a MySQL. |
| `npm run db:check` | Comprueba consistencia e integridad entre el esquema TypeScript y las migraciones. |

---

## 3. El Gestor de Base de Datos Integrado: Drizzle Studio

Drizzle incluye su propia herramienta administrativa gráfica nativa: **Drizzle Studio**. No necesitas instalar clientes externos pesados como MySQL Workbench, DBeaver o phpMyAdmin.

### ¿Cómo iniciar Drizzle Studio?

1. Asegúrate de que MySQL esté encendido (por ejemplo, con Docker Compose en la raíz: `docker compose up -d`).
2. En la terminal, entra a `backend` y ejecuta:
   ```bash
   npm run db:studio
   ```
3. La terminal mostrará:
   ```text
   Drizzle Studio is up and running on https://local.drizzle.studio
   ```
4. Abre esa URL en tu navegador web. Studio se conectará de inmediato a tu base de datos local mediante el puerto `4983` que expone localmente.

### Capacidades de Drizzle Studio:
* **Exploración de datos**: Navega por cualquiera de las 38 tablas del sistema con paginación, filtros dinámicos y ordenamiento por cualquier columna.
* **Edición en vivo (*Inline Editing*)**: Haz doble clic en cualquier celda para modificar valores numéricos, textos, fechas o campos JSON directamente.
* **Creación de registros**: Agrega filas con botones visuales que respetan las validaciones de tipo de cada columna (UUIDs, timestamps, enums).
* **Inspección de Relaciones**: Navega a través de claves foráneas entre tablas relacionadas (ej. de una publicación `room_listings` al usuario anfitrión `auth_users` o sus fotos `room_photos`).
* **Ejecutor SQL integrado (*SQL Runner*)**: Puedes escribir consultas SQL personalizadas directamente en la interfaz web y ver los resultados en formato tabular.

> [!TIP]
> Si estás corriendo en un servidor remoto o dentro de un contenedor y quieres que escuche en todas las interfaces de red, puedes ejecutar:
> ```bash
> npx drizzle-kit studio --host 0.0.0.0 --port 4983
> ```

---

## 4. Arquitectura de Acceso a Datos: Los Repositorios son el Único Puente

En el backend de Room_Link se sigue estrictamente la arquitectura limpia y DDD:

> [!IMPORTANT]
> **Ni la Base de Datos se toca directamente en la lógica, ni los Modelos de Dominio se conectan a la BD.**
>
> Los **Repositorios** son el único puente autorizado para ejecutar consultas Drizzle ORM y hablar con MySQL.

```text
  ┌──────────────────────────────────────────────────────────────┐
  │                        Capa HTTP (Hono)                      │
  │                  modules/*/*.controller.ts                   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Llama al servicio
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                 Capa de Casos de Uso / Servicio              │
  │                   modules/*/*.service.ts                     │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Usa interfaces (IUserRepository...)
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                   Capa de Dominio Única (DDD)                │
  │                   domain/entities/*.ts                       │
  │   - Clases de negocio puras (User, Profile, RoomListing)     │
  │   - NO contienen SQL, NO importan Drizzle, NO tocan la BD   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Implementado por
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │             Capa de Infraestructura (Drizzle ORM)             │
  │         infrastructure/repositories/Drizzle*Repository.ts    │
  │   - ÚNICO lugar que importa 'db' y tablas de Drizzle         │
  │   - Ejecuta consultas tipadas con $inferSelect/$inferInsert  │
  │   - Mapea filas de la base de datos a Entidades de Dominio   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ mysql2 pool
                                 ▼
                          [ MySQL 8.4 ]
```

### Reglas Claras para el Equipo:
* **¿Un Servicio puede hacer `db.select()`?** ❌ **NO**. El servicio solo debe llamar a `this.userRepo.findById(id)`.
* **¿Un Modelo de Dominio puede tener `user.save()` o conectarse a MySQL?** ❌ **NO**. Las entidades de dominio son modelos puros de negocio (no Active Record).
* **¿Dónde vive Drizzle?** ✅ **Exclusivamente en `src/infrastructure/repositories/` y en `src/db/`**.

---

## 5. Explotando al 100% los Tipos Generados por Drizzle

Uno de los mayores superpoderes de Drizzle ORM es que **no necesitas escribir interfaces TypeScript duplicadas a mano**. Drizzle infiere automáticamente los tipos exactos de la base de datos a partir de la definición de cada tabla:

### A. Los dos tipos fundamentales por tabla

Para cada tabla del esquema se exportan automáticamente dos tipos:
1. **`$inferSelect` (o `typeof table.$inferSelect`)**:
   Representa la fila completa que devuelve la base de datos al hacer un `SELECT`. Todos los campos generados por la BD (como `id`, `createdAt`, `updatedAt`) están presentes y no son opcionales.
2. **`$inferInsert` (o `typeof table.$inferInsert`)**:
   Representa el objeto que debes enviar para hacer un `INSERT`. Drizzle detecta inteligentemente qué campos son obligatorios y cuáles son opcionales porque tienen valores por defecto (`defaultNow()`, `autoincrement()`, `default(sql\`(UUID())\`)`, o permiten `NULL`).

### B. Catálogo de Tipos Disponibles en el Proyecto

Todos estos tipos ya están generados y disponibles para importar desde `src/db/schema/index.js`:

| Módulo / Esquema | Tipo SELECT (`$inferSelect`) | Tipo INSERT (`$inferInsert`) |
|---|---|---|
| **Autenticación** (`auth.ts`) | `AuthUserRow`, `AuthUserRoleRow`, `AuthSessionRow`, `AuthLoginAttemptRow` | `NewAuthUser`, `NewAuthUserRole`, `NewAuthSession`, `NewAuthLoginAttempt` |
| **Perfiles** (`profile.ts`) | `ProfileRow`, `ProfilePhotoRow`, `ProfileContactPrivacyRow`, `ProfileHousingPreferenceRow` | `NewProfile`, `NewProfilePhoto`, `NewProfileContactPrivacy`, `NewProfileHousingPreference` |
| **Habitaciones** (`rooms.ts`) | `RoomListingRow`, `RoomPhotoRow`, `RoomRuleRow`, `RoomCostItemRow`, `RoomFavoriteRow` | `NewRoomListing`, `NewRoomPhoto`, `NewRoomRule`, `NewRoomCostItem`, `NewRoomFavorite` |
| **Compatibilidad** (`compatibility.ts`) | `CompatProfileRow`, `CompatDimensionWeightRow`, `MatchAffinityScoreRow`, `MatchSavedProfileRow` | `NewCompatProfile`, `NewCompatDimensionWeight`, `NewMatchAffinityScore`, `NewMatchSavedProfile` |
| **Social / Mensajes** (`social.ts`) | `AppApplicationRow`, `ConnConnectionRow`, `ChatRoomRow`, `ChatRoomMemberRow`, `ChatMessageRow` | `NewAppApplication`, `NewConnConnection`, `NewChatRoom`, `NewChatRoomMember`, `NewChatMessage` |
| **Geografía** (`geo.ts`) | `GeoZoneRow`, `GeoLocationRow`, `GeoPointOfInterestRow` | `NewGeoZone`, `NewGeoLocation`, `NewGeoPointOfInterest` |
| **Gobernanza / Moderación** (`governance.ts`) | `ModReportRow`, `ModSanctionRow`, `ModActivityLogRow`, `NotifNotificationRow` | `NewModReport`, `NewModSanction`, `NewModActivityLog`, `NewNotifNotification` |
| **Core** (`core.ts`) | `CoreOutboxEventRow` | `NewCoreOutboxEvent` |

### C. Mapeo en Repositorios: De Tipo Drizzle a Entidad de Dominio

Los repositorios reciben los tipos de Drizzle y los transforman a los modelos del dominio:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { roomListings, type RoomListingRow, type NewRoomListing } from "../db/schema/rooms.js";
import { RoomListing } from "../../domain/index.js";

export class DrizzleRoomListingRepository {
  // 1. SELECT: Recibe RoomListingRow ($inferSelect) y retorna la Entidad pura de Dominio
  async findById(id: string): Promise<RoomListing | null> {
    const rows: RoomListingRow[] = await db
      .select()
      .from(roomListings)
      .where(eq(roomListings.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Hidratación hacia el Modelo de Dominio con sus reglas de negocio:
    return new RoomListing({
      id: row.id,
      hostId: row.hostId,
      title: row.title,
      monthlyRent: Number(row.monthlyRent),
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  // 2. INSERT: Transforma la Entidad de Dominio a NewRoomListing ($inferInsert)
  async create(room: RoomListing): Promise<void> {
    const record: NewRoomListing = {
      id: room.id,
      hostId: room.hostId,
      title: room.title,
      monthlyRent: room.monthlyRent.toFixed(2),
      status: room.status,
      // Drizzle sabe que createdAt tiene defaultNow() en la base de datos
    };

    await db.insert(roomListings).values(record);
  }
}
```


---

### D. Tipado en Selecciones Parciales

Si solo consultas ciertas columnas, Drizzle infiere automáticamente la forma resultante:

```typescript
// users tiene tipo: { id: string; email: string }[]
const users = await db
  .select({
    id: authUsers.id,
    email: authUsers.email,
  })
  .from(authUsers);
```

---

## 5. Ejemplos Prácticos de Consultas Tipadas

### A. Consultas de Lectura (`SELECT`) con Operadores

```typescript
import { eq, and, or, gte, lte, like, desc } from "drizzle-orm";
import { roomListings } from "../db/schema/rooms.js";

// Buscar habitaciones activas con renta entre $2,000 y $4,500
const listings = await db
  .select()
  .from(roomListings)
  .where(
    and(
      eq(roomListings.status, "published"),
      gte(roomListings.monthlyRent, "2000.00"),
      lte(roomListings.monthlyRent, "4500.00")
    )
  )
  .orderBy(desc(roomListings.createdAt))
  .limit(10)
  .offset(0);
```

---

### B. Inserciones Tipadas (`INSERT`)

```typescript
import { authUsers, type NewAuthUser } from "../db/schema/auth.js";

const newUser: NewAuthUser = {
  email: "estudiante@ejemplo.com",
  passwordHash: "hash_seguro",
  termsAcceptedAt: new Date(),
  // id, status y createdAt son opcionales aquí porque tienen defaults en la base de datos
};

await db.insert(authUsers).values(newUser);
```

---

### C. Actualizaciones (`UPDATE`)

```typescript
await db
  .update(authUsers)
  .set({
    status: "suspended",
    updatedAt: new Date(),
  })
  .where(eq(authUsers.id, userId));
```

---

### D. Eliminaciones (`DELETE`)

```typescript
await db
  .delete(authUsers)
  .where(eq(authUsers.id, userId));
```

---

### E. Relaciones y Joins Fuertemente Tipados

```typescript
import { authUsers, profileProfiles } from "../db/schema/index.js";

const usersWithProfile = await db
  .select({
    userId: authUsers.id,
    email: authUsers.email,
    fullName: profileProfiles.fullName,
    occupation: profileProfiles.occupation,
  })
  .from(authUsers)
  .leftJoin(profileProfiles, eq(authUsers.id, profileProfiles.userId))
  .where(eq(authUsers.status, "active"));
```

---

### F. Transacciones ACID Atómicas

Si necesitas ejecutar múltiples operaciones donde todo debe guardarse o todo cancelarse:

```typescript
await db.transaction(async (tx) => {
  // Ambas operaciones usan el cliente 'tx'
  await tx.insert(authUsers).values({
    id: userId,
    email: "nuevo@uni.edu",
    termsAcceptedAt: new Date(),
  });

  await tx.insert(authUserRoles).values({
    userId: userId,
    role: "seeker",
  });
});
```

---

## 6. Flujo de Trabajo para Modificar la Base de Datos

Cuando necesites agregar una columna o una nueva tabla al sistema:

1. **Edita el archivo en `src/db/schema/<archivo>.ts`**: Agrega la columna o define la nueva tabla con `mysqlTable(...)`.
2. **Exporta los tipos inferidos**:
   ```typescript
   export type NuevaTablaRow = typeof nuevaTabla.$inferSelect;
   export type NewNuevaTabla = typeof nuevaTabla.$inferInsert;
   ```
3. **Genera la migración SQL**:
   ```bash
   npm run db:generate
   ```
   Drizzle Kit comparará tu código TypeScript con el snapshot anterior y creará automáticamente el script `.sql` necesario en `backend/drizzle/`.
4. **Aplica los cambios a MySQL**:
   ```bash
   npm run db:migrate
   ```
5. **Abre Drizzle Studio para verificar**:
   ```bash
   npm run db:studio
   ```
   Visualiza tu nueva tabla y datos en tu navegador web.
