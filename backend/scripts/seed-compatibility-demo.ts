import "dotenv/config";
import { like } from "drizzle-orm";
import { closeDatabase, db } from "../src/db/client.js";
import * as schema from "../src/db/schema/index.js";
import { DrizzleCompatibilityRepository } from "../src/infrastructure/repositories/DrizzleCompatibilityRepository.js";
import { CompatibilityService } from "../src/modules/compatibility/compatibility.service.js";

const DEMO_EMAIL_PREFIX = "hu04-demo-";
const DEMO_EMAIL_PATTERN = `${DEMO_EMAIL_PREFIX}%@roomlink.invalid`;
const ZONE_ID = "00000000-0000-4000-8000-000000000003";
const DEFAULT_CANDIDATE_COUNT = 12;
const MAX_CANDIDATE_COUNT = 10_000;
const TEST_VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const INCOMPLETE_VIEWER_ID = "00000000-0000-4000-8000-000000000002";
const TEST_ANSWERS = {
  schedule: 1,
  cleanliness: 1,
  noise: 1,
  pets: 1,
  smoking: 1,
  visits: 1,
  genderPref: 1,
} as const;

function uuidFor(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function getOptions() {
  const countOption = process.argv.find((argument) =>
    argument.startsWith("--count="),
  );
  const candidateCount = countOption
    ? Number(countOption.slice("--count=".length))
    : DEFAULT_CANDIDATE_COUNT;
  if (
    !Number.isSafeInteger(candidateCount) ||
    candidateCount < 3 ||
    candidateCount > MAX_CANDIDATE_COUNT
  ) {
    throw new Error(
      `--count debe ser un entero entre 3 y ${MAX_CANDIDATE_COUNT}.`,
    );
  }

  const benchmark = process.argv.includes("--benchmark");
  if (benchmark && candidateCount !== MAX_CANDIDATE_COUNT) {
    throw new Error("La prueba de rendimiento requiere --count=10000.");
  }

  return {
    candidateCount,
    reset: process.argv.includes("--reset"),
    benchmark,
  };
}

function inBatches<T>(items: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function answersForCandidate(index: number) {
  if (index === 0) return { ...TEST_ANSWERS };
  if (index === 1) {
    return {
      schedule: 5,
      cleanliness: 5,
      noise: 5,
      pets: 5,
      smoking: 5,
      visits: 5,
      genderPref: 5,
    };
  }
  if (index === 2) return { ...TEST_ANSWERS, schedule: 2 };

  return {
    schedule: (index % 5) + 1,
    cleanliness: ((index + 1) % 5) + 1,
    noise: ((index + 2) % 5) + 1,
    pets: ((index + 3) % 5) + 1,
    smoking: ((index + 4) % 5) + 1,
    visits: ((index + 1) % 5) + 1,
    genderPref: ((index + 2) % 5) + 1,
  };
}

async function seedDemoUsers(
  candidateCount: number,
  reset: boolean,
): Promise<void> {
  const candidates = Array.from({ length: candidateCount }, (_, index) => {
    const number = index + 1;
    return {
      id: uuidFor(1000 + number),
      number,
      name: `Roomie de prueba ${String(number).padStart(2, "0")}`,
      age: 20 + (index % 15),
      answers: answersForCandidate(index),
    };
  });
  const users = [
    {
      id: TEST_VIEWER_ID,
      email: `${DEMO_EMAIL_PREFIX}visor-con-test@roomlink.invalid`,
      name: "Alex Demo",
      age: 25,
    },
    {
      id: INCOMPLETE_VIEWER_ID,
      email: `${DEMO_EMAIL_PREFIX}visor-sin-test@roomlink.invalid`,
      name: "Sam Demo",
      age: 24,
    },
    ...candidates.map((candidate) => ({
      id: candidate.id,
      email: `${DEMO_EMAIL_PREFIX}candidato-${candidate.number}@roomlink.invalid`,
      name: candidate.name,
      age: candidate.age,
    })),
  ];
  const now = new Date();

  await db.transaction(async (transaction) => {
    if (reset) {
      await transaction
        .delete(schema.authUsers)
        .where(like(schema.authUsers.email, DEMO_EMAIL_PATTERN));
    }

    await transaction
      .insert(schema.geoZones)
      .values({
        id: ZONE_ID,
        name: "Centro",
        city: "León",
        state: "Guanajuato",
      })
      .onDuplicateKeyUpdate({
        set: { name: "Centro", city: "León", state: "Guanajuato" },
      });

    for (const batch of inBatches(users)) {
      await transaction
        .insert(schema.authUsers)
        .values(
          batch.map((user) => ({
            id: user.id,
            email: user.email,
            passwordHash: "demo-only-no-login",
            status: "active" as const,
            termsAcceptedAt: now,
          })),
        )
        .onDuplicateKeyUpdate({ set: { status: "active" } });

      await transaction
        .insert(schema.authUserRoles)
        .values(batch.map((user) => ({ userId: user.id, role: "seeker" as const })))
        .onDuplicateKeyUpdate({ set: { role: "seeker" } });

      await transaction
        .insert(schema.profileProfiles)
        .values(
          batch.map((user) => ({
            userId: user.id,
            fullName: user.name,
            birthDate: new Date(Date.UTC(now.getFullYear() - user.age, 5, 15)),
            occupation: "Perfil de demostración",
            bio: "Cuenta de prueba para visualizar recomendaciones y perfiles de Room Link.",
          })),
        )
        .onDuplicateKeyUpdate({ set: { updatedAt: now } });

      await transaction
        .insert(schema.profileHousingPreferences)
        .values(
          batch.map((user, index) => ({
            userId: user.id,
            seeking: "roommate" as const,
            budgetMin: String(3000 + (index % 5) * 500),
            budgetMax: String(5000 + (index % 5) * 500),
            desiredZoneId: ZONE_ID,
          })),
        )
        .onDuplicateKeyUpdate({
          set: {
            desiredZoneId: ZONE_ID,
          },
        });

      await transaction
        .insert(schema.profilePhotos)
        .values(
          batch.map((user, index) => ({
            userId: user.id,
            url: `https://i.pravatar.cc/600?img=${(index % 70) + 1}`,
            position: 1,
          })),
        )
        .onDuplicateKeyUpdate({
          set: { position: 1 },
        });
    }

    const compatibilityUsers = [
      { userId: TEST_VIEWER_ID, answers: TEST_ANSWERS },
      ...candidates.map(({ id, answers }) => ({ userId: id, answers })),
    ];
    for (const batch of inBatches(compatibilityUsers)) {
      await transaction
        .insert(schema.compatProfiles)
        .values(
          batch.map(({ userId, answers }) => ({
            userId,
            ...answers,
            completedAt: now,
            updatedAt: now,
          })),
        )
        .onDuplicateKeyUpdate({
          set: { updatedAt: now },
        });
    }
  });
}

async function benchmarkFeed(): Promise<void> {
  const service = new CompatibilityService(
    new DrizzleCompatibilityRepository(db),
  );
  await service.getFeed(TEST_VIEWER_ID, 1);

  const durations: number[] = [];
  for (let sample = 0; sample < 50; sample += 1) {
    const start = performance.now();
    await service.getFeed(TEST_VIEWER_ID, 1);
    durations.push(performance.now() - start);
  }

  durations.sort((left, right) => left - right);
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95 = durations[p95Index];
  if (p95 === undefined) {
    throw new Error("No se pudieron obtener mediciones del feed.");
  }

  console.log(`Feed con 10,000 candidatos: P95 ${p95.toFixed(2)} ms.`);
  if (p95 > 350) {
    throw new Error("El P95 del feed supera el objetivo de 350 ms.");
  }
}

async function main() {
  const { candidateCount, reset, benchmark } = getOptions();
  await seedDemoUsers(candidateCount, reset);

  console.log(`Se prepararon ${candidateCount} candidatos de demostración.`);
  console.log(`Usuario con test: ${TEST_VIEWER_ID}`);
  console.log(`Usuario sin test: ${INCOMPLETE_VIEWER_ID}`);
  console.log(
    "Las fotos de demostración usan imágenes externas y requieren conexión a internet.",
  );

  if (benchmark) {
    await benchmarkFeed();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    "No se pudieron preparar o validar los datos de demostración:",
    error,
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
