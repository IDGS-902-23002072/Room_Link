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

## 4. Explotando al 100% los Tipos Generados por Drizzle

Uno de los mayores superpoderes de Drizzle ORM es que **no necesitas escribir interfaces TypeScript duplicadas a mano**. Drizzle infiere automáticamente los tipos exactos de la base de datos a partir de la definición de cada tabla:

### A. Los dos tipos fundamentales por tabla

Para cada tabla existen dos tipos generados:
1. **`$inferSelect` (o `InferSelectModel<typeof tabla>`)**:
   Representa la fila completa que devuelve la base de datos al hacer un `SELECT`. Todos los campos generados por la BD (como `id`, `createdAt`, `updatedAt`) están presentes y no son opcionales.
2. **`$inferInsert` (o `InferInsertModel<typeof tabla>`)**:
   Representa el objeto que debes enviar para hacer un `INSERT`. Drizzle detecta inteligentemente qué campos son obligatorios y cuáles son opcionales porque tienen valores por defecto (`defaultNow()`, `autoincrement()`, `default(sql\`(UUID())\`)`, o permiten `NULL`).

### B. Ejemplo en `src/db/schema/rooms.ts`:

```typescript
import { mysqlTable, char, varchar, decimal, timestamp, date } from "drizzle-orm/mysql-core";

export const roomListings = mysqlTable("room_listings", {
  id: char("id", { length: 36 }).primaryKey().notNull().default(sql`(UUID())`),
  hostId: char("host_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  monthlyRent: decimal("monthly_rent", { precision: 10, scale: 2 }).notNull(),
  availableFrom: date("available_from"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🚀 Tipos inferidos automáticamente exportados:
export type RoomListingRow = typeof roomListings.$inferSelect;
export type NewRoomListing = typeof roomListings.$inferInsert;
```

¿Qué diferencia hay entre `RoomListingRow` y `NewRoomListing`?
* En `RoomListingRow`: `id` es `string`, `createdAt` es `Date`.
* En `NewRoomListing`: `id` es `string | undefined` (porque MySQL o Drizzle le asigna UUID automáticamente) y `createdAt` es `Date | undefined` (porque tiene `defaultNow()`). ¡TypeScript nunca te obligará a enviar campos que la base de datos ya sabe generar!

---

### C. Uso de los tipos en la Capa de Infraestructura / Repositorios

Los repositorios utilizan estos tipos directamente para garantizar cero errores en tiempo de compilación:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  roomListings,
  type RoomListingRow,
  type NewRoomListing
} from "../db/schema/rooms.js";

export class DrizzleRoomListingRepository {
  // 1. SELECT tipado con RoomListingRow:
  async findById(id: string): Promise<RoomListingRow | null> {
    const rows: RoomListingRow[] = await db
      .select()
      .from(roomListings)
      .where(eq(roomListings.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  // 2. INSERT tipado con NewRoomListing:
  async create(data: NewRoomListing): Promise<void> {
    // TypeScript valida exactamente los campos obligatorios:
    await db.insert(roomListings).values(data);
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
