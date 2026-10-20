import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { RowDataPacket } from "mysql2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, db, pool } from "../../src/db/client.js";

interface CountRow extends RowDataPacket {
  total: number;
}

const run = async (statement: string, values: any[] = []): Promise<void> => {
  await pool.execute(statement, values);
};

describe("MySQL schema", () => {
  const ownerId = randomUUID();
  const applicantId = randomUUID();
  const zoneId = randomUUID();
  const locationId = randomUUID();
  const listingId = randomUUID();

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await run(
      "INSERT INTO auth_users (id, email, password_hash, terms_accepted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP(6)), (?, ?, ?, CURRENT_TIMESTAMP(6))",
      [
        ownerId,
        `owner-${ownerId}@roomlink.test`,
        "test-hash",
        applicantId,
        `applicant-${applicantId}@roomlink.test`,
        "test-hash",
      ],
    );
  });

  afterAll(async () => {
    await run("DELETE FROM auth_users WHERE id IN (?, ?)", [ownerId, applicantId]);
    await run("DELETE FROM geo_locations WHERE id = ?", [locationId]);
    await run("DELETE FROM geo_zones WHERE id = ?", [zoneId]);
    await closeDatabase();
  });

  it("creates the complete schema and reference data", async () => {
    const [tableRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> '__drizzle_migrations'",
    );
    const [viewRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.views WHERE table_schema = DATABASE()",
    );
    const [weightRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM compat_dimension_weights",
    );

    expect(tableRows[0]?.total).toBe(38);
    expect(viewRows[0]?.total).toBe(4);
    expect(weightRows[0]?.total).toBe(7);
  });

  it("rejects profiles for minors", async () => {
    await expect(
      run(
        "INSERT INTO profile_profiles (user_id, full_name, birth_date) VALUES (?, 'Estudiante menor', DATE_SUB(CURRENT_DATE(), INTERVAL 17 YEAR))",
        [ownerId],
      ),
    ).rejects.toThrow(/18 años/);
  });

  it("enforces publication and application rules", async () => {
    await run("INSERT INTO geo_zones (id, name, city) VALUES (?, ?, ?)", [
      zoneId,
      `Zona ${zoneId}`,
      "León",
    ]);
    await run(
      "INSERT INTO geo_locations (id, zone_id, address, latitude, longitude) VALUES (?, ?, 'Dirección de prueba', 21.122100, -101.683000)",
      [locationId, zoneId],
    );
    await run(
      "INSERT INTO room_listings (id, host_id, location_id, title, monthly_rent) VALUES (?, ?, ?, 'Habitación de prueba', 3500.00)",
      [listingId, ownerId, locationId],
    );

    await expect(
      run("UPDATE room_listings SET status = 'published' WHERE id = ?", [
        listingId,
      ]),
    ).rejects.toThrow(/3 fotos/);

    for (const position of [1, 2, 3]) {
      await run(
        "INSERT INTO room_photos (id, listing_id, url, position) VALUES (?, ?, ?, ?)",
        [randomUUID(), listingId, `https://example.test/${position}.jpg`, position],
      );
    }

    await run("UPDATE room_listings SET status = 'published' WHERE id = ?", [
      listingId,
    ]);
  });

  it("allows only one active connection per unordered user pair", async () => {
    await run(
      "INSERT INTO conn_connections (id, requester_id, addressee_id, status) VALUES (UUID(), ?, ?, 'accepted')",
      [ownerId, applicantId],
    );

    await expect(
      run(
        "INSERT INTO conn_connections (id, requester_id, addressee_id, status) VALUES (UUID(), ?, ?, 'pending')",
        [applicantId, ownerId],
      ),
    ).rejects.toThrow();
  });
});
