# Guía de Uso de Drizzle ORM en Room_Link

Esta guía explica cómo funciona y cómo utilizar **Drizzle ORM** con **MySQL 8** en el backend de Room_Link.

---

## 1. ¿Qué es Drizzle ORM y cómo se organiza?

Drizzle es un ORM TypeScript ligero y de alto rendimiento que no tiene sobrecarga de tiempo de ejecución y proporciona tipado estático total (`type-safe`).

En este proyecto, la estructura de base de datos se organiza así:

```text
backend/
├── drizzle.config.ts              # Configuración de Drizzle Kit (CLI de migraciones)
├── drizzle/                       # Archivos SQL generados automáticamente
│   ├── 0000_smooth_titanium_man.sql
│   └── meta/
├── src/
│   └── db/
│       ├── client.ts              # Instancia de conexión (pool mysql2 + db)
│       ├── migrate.ts             # Script ejecutor de migraciones
│       └── schema/                # Definición de tablas en TypeScript
│           ├── auth.ts            # Usuarios, roles, sesiones
│           ├── profile.ts         # Perfiles de estudiantes, fotos
│           ├── rooms.ts           # Publicaciones de cuartos, costos, fotos
│           ├── compatibility.ts   # Cuestionario de convivencia
│           ├── social.ts          # Solicitudes y mensajes
│           ├── governance.ts      # Reportes y bloqueos
│           ├── geo.ts             # Zonas y coordenadas
│           └── index.ts           # Exportación unificada de esquemas
```

---

## 2. Comandos Principales

Ejecuta estos comandos dentro de la carpeta `backend/`:

| Comando | Descripción |
|---|---|
| `npm run db:generate` | Lee tus esquemas en `src/db/schema/` y genera nuevos archivos `.sql` en `drizzle/`. |
| `npm run db:migrate` | Aplica las migraciones SQL pendientes a la base de datos MySQL activa. |
| `npm run db:check` | Valida que las migraciones y metadatos no tengan conflictos ni cambios rotos. |
| `npx drizzle-kit studio` | Abre una interfaz web gráfica en `https://local.drizzle.studio` para explorar tablas y registros. |

### Flujo habitual cuando cambias la base de datos:
1. Modificas o creas una tabla en `src/db/schema/<archivo>.ts`.
2. Corres `npm run db:generate` para crear la migración SQL.
3. Corres `npm run db:migrate` para aplicarla a tu MySQL local o contenedor Docker.

---

## 3. Cómo usar Drizzle en el código

### Importar la conexión y las tablas

Siempre importa el cliente `db` desde `src/db/client.js` y las tablas correspondientes desde `src/db/schema/index.js`:

```typescript
import { db } from "../db/client.js";
import { authUsers, roomListings } from "../db/schema/index.js";
import { eq, and, or, desc, like, gte, lte } from "drizzle-orm";
```

---

### A. Consultas de Lectura (`SELECT`)

#### 1. Obtener todos los registros:
```typescript
const allUsers = await db.select().from(authUsers);
```

#### 2. Filtrar con `WHERE` y `eq`:
```typescript
const user = await db
  .select()
  .from(authUsers)
  .where(eq(authUsers.email, "estudiante@ejemplo.com"))
  .limit(1);

const found = user[0] ?? null;
```

#### 3. Seleccionar sólo ciertas columnas:
```typescript
const usersSummary = await db
  .select({
    id: authUsers.id,
    email: authUsers.email,
  })
  .from(authUsers);
```

#### 4. Filtros compuestos (`and`, `or`, `gte`, `lte`):
```typescript
const availableRooms = await db
  .select()
  .from(roomListings)
  .where(
    and(
      eq(roomListings.status, "published"),
      gte(roomListings.monthlyRent, "1500.00"),
      lte(roomListings.monthlyRent, "4000.00")
    )
  )
  .orderBy(desc(roomListings.createdAt))
  .limit(10);
```

---

### B. Inserción (`INSERT`)

```typescript
import { randomUUID } from "node:crypto";

await db.insert(authUsers).values({
  id: randomUUID(),
  email: "nuevo@roomlink.test",
  passwordHash: "hash_seguro",
  status: "active",
  termsAcceptedAt: new Date(),
});
```

Para insertar múltiples registros de una vez:
```typescript
await db.insert(roomPhotos).values([
  { id: randomUUID(), listingId: "r-1", url: "https://foto1.jpg", position: 1 },
  { id: randomUUID(), listingId: "r-1", url: "https://foto2.jpg", position: 2 },
  { id: randomUUID(), listingId: "r-1", url: "https://foto3.jpg", position: 3 },
]);
```

---

### C. Actualización (`UPDATE`)

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

### D. Eliminación (`DELETE`)

```typescript
await db
  .delete(authUsers)
  .where(eq(authUsers.id, userId));
```

---

### E. Relaciones y Joins

Drizzle permite realizar `INNER JOIN`, `LEFT JOIN`, etc., manteniendo el tipado exacto:

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

### F. Transacciones (ACID)

Si necesitas ejecutar múltiples operaciones atómicamente (si una falla, se cancelan todas):

```typescript
await db.transaction(async (tx) => {
  // 1. Crear el usuario dentro de la transacción
  await tx.insert(authUsers).values({
    id: userId,
    email: "estudiante@uni.edu",
    termsAcceptedAt: new Date(),
  });

  // 2. Asignar el rol
  await tx.insert(authUserRoles).values({
    userId: userId,
    role: "seeker",
  });
});
```

---

## 4. Arquitectura: Drizzle en el Monolito Modular con DDD

En nuestra arquitectura:
1. **El Dominio (`src/domain/`) es independiente de Drizzle:** Las entidades (`User`, `Profile`, `RoomListing`, `Application`) no contienen código de Drizzle ni SQL.
2. **Infraestructura (`src/infrastructure/repositories/`) implementa los repositorios:**
   - `DrizzleUserRepository`, `DrizzleProfileRepository`, etc., usan `db` de Drizzle para guardar y consultar, y convierten las filas de la base de datos en entidades de Dominio (`new User(...)`).
3. **Los Módulos (`src/modules/`) consumen los servicios:**
   - El controlador (`controller.ts`) y la vista (`view.ts`) nunca tocan Drizzle directamente.
   - De esta forma, si mañana cambias el ORM o la base de datos, el dominio y los controladores no se rompen.
