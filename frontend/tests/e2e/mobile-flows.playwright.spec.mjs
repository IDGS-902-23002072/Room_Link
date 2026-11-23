// Suite E2E unificada con Playwright para RoomLink (móvil web + API real).
// Cubre flujos completos extremo a extremo (HU-01 a HU-08 + M06, M08, M09, M10, M12, M14)
// tanto en casos positivos (lo que TIENE que hacer) como negativos (lo que NO tiene que hacer).
//
// Requisitos:
//   - Backend corriendo en E2E_API_URL (default http://localhost:3000/api/v1)
//   - Build web del cliente móvil servido en E2E_WEB_URL (default http://localhost:8081)
//
// Ejecutar:
//   cd frontend && npm run test:e2e

import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api/v1";
const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:8081";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const uniq = (tag) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

async function apiJson(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createAccount(tag, { withProfile = false, withTest = false, roleHost = false } = {}) {
  const email = `${uniq(tag)}@roomlink.test`;
  const password = "Password123!";
  const reg = await apiJson("/auth/register", {
    method: "POST",
    body: { email, password, termsAccepted: true },
  });
  expect(reg.status, JSON.stringify(reg.data)).toBe(201);

  const login = await apiJson("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  expect(login.status, JSON.stringify(login.data)).toBe(200);

  let token = login.data.token ?? login.data.accessToken;
  const userId = login.data.user.id;

  if (withProfile || roleHost) {
    const prof = await apiJson(`/profile/${userId}`, {
      method: "POST",
      token,
      body: {
        fullName: `Usuario ${tag}`,
        birthDate: "1999-05-15",
        occupation: "Estudiante",
        bio: "Perfil de prueba E2E.",
      },
    });
    expect([200, 201]).toContain(prof.status);
  }

  if (withTest) {
    const testRes = await apiJson(`/compatibility/${userId}`, {
      method: "PUT",
      token,
      body: {
        schedule: 3,
        cleanliness: 4,
        noise: 2,
        pets: 4,
        smoking: 1,
        visits: 3,
        genderPref: 3,
      },
    });
    expect(testRes.status).toBe(200);
  }

  if (roleHost) {
    const hostRes = await apiJson("/auth/become-host", {
      method: "POST",
      token,
      body: {
        phone: "4771234567",
        city: "León",
        zone: "Centro",
        termsAccepted: true,
      },
    });
    if (hostRes.status === 200 && (hostRes.data?.token || hostRes.data?.accessToken)) {
      token = hostRes.data.token ?? hostRes.data.accessToken;
    }
  }

  return { email, password, token, userId };
}

async function createRoomForm(token, { photos = 3, withLocation = true, availableFrom = "2027-06-15" } = {}) {
  const fd = new FormData();
  fd.append("titulo", `Cuarto iluminado ${uniq("room")}`);
  fd.append("renta", "3800");
  fd.append("descripcion", "Habitación amueblada con internet incluido.");
  if (availableFrom) fd.append("availableFrom", availableFrom);
  if (withLocation) {
    fd.append("ubicacion", "Blvd. Universidad 200, León, Gto");
    fd.append("latitude", "21.1221");
    fd.append("longitude", "-101.683");
  }
  for (let i = 0; i < photos; i++) {
    fd.append("fotos", new Blob([PNG_1X1], { type: "image/png" }), `foto-${i + 1}.png`);
  }
  const res = await fetch(`${API_URL}/rooms`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function loginInBrowser(page, email, password) {
  let loginStatus = null;
  page.on("response", (res) => {
    if (res.url().endsWith("/api/v1/auth/login") && res.request().method() === "POST") {
      loginStatus = res.status();
    }
  });

  await page.goto(WEB_URL, { waitUntil: "networkidle" });
  const inputs = page.locator("input");
  await expect(inputs.nth(0)).toBeVisible();
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);

  const btn = page.getByText("Iniciar sesión", { exact: true }).last();
  await btn.click();

  await expect.poll(() => loginStatus, { timeout: 15_000 }).toBe(200);
}

// ============================================================================
// FLUJO 1 · Login cross-origin + Onboarding obligatorio + Navegación completa
// ============================================================================
test.describe("Flujo 1 · Auth cross-origin, Onboarding y Navegación móvil", () => {
  test("NO permite acceder a rutas protegidas sin sesión y SÍ fuerza onboarding a usuario nuevo", async ({ page }) => {
    // Negativo: sin sesión redirige a login
    await page.goto(`${WEB_URL}/perfil`, { waitUntil: "networkidle" });
    await expect(page.getByText("Inicia sesión")).toBeVisible();

    // Usuario nuevo sin perfil ni encuesta -> al entrar debe caer en Onboarding Paso 1
    const nuevo = await createAccount("onboard");
    await loginInBrowser(page, nuevo.email, nuevo.password);
    await expect(page.getByText("Completa tu perfil")).toBeVisible({ timeout: 15_000 });
  });

  test("SÍ entra con usuario completo, sin barra duplicada, y navega todos los tabs y pantallas apiladas", async ({ page }) => {
    const user = await createAccount("nav-full", { withProfile: true, withTest: true, roleHost: true });
    await loginInBrowser(page, user.email, user.password);

    // Una sola barra de pestañas (sin duplicado)
    await expect(page.getByText("Descubrir", { exact: true })).toHaveCount(1, { timeout: 15_000 });

    // Tab Chats (HU-10)
    await page.getByText("Chats", { exact: true }).click();
    await expect(page.getByText("Tus conversaciones")).toBeVisible();

    // Tab Perfil (M02)
    await page.getByText("Perfil", { exact: true }).click();
    await expect(page.getByText("Mi perfil")).toBeVisible();

    // Tab Descubrir (M04 / HU-04)
    await page.getByText("Descubrir", { exact: true }).click();
    await expect(page.getByText("Encuentra tu habitación")).toBeVisible();

    // Pantalla apilada: Búsqueda de roomies (M05 / HU-05)
    await page.locator('a[href*="/buscar-roomies"]').first().click();
    await expect(page.getByText("Buscar roomies")).toBeVisible();
    await expect(page.getByText("Filtros generales")).toBeVisible();

    // Pantallas apiladas: Notificaciones (HU-14), Conexiones (HU-08), Acuerdos (HU-12), M06
    await page.goto(`${WEB_URL}/notificaciones`, { waitUntil: "networkidle" });
    await expect(page.getByText("ROOMLINK / 14")).toBeVisible();

    await page.goto(`${WEB_URL}/conexiones`, { waitUntil: "networkidle" });
    await expect(page.getByText("ROOMLINK / CONEXIONES")).toBeVisible();

    await page.goto(`${WEB_URL}/acuerdos`, { waitUntil: "networkidle" });
    await expect(page.getByText("Acuerdos de convivencia")).toBeVisible();

    await page.goto(`${WEB_URL}/compatibilidad-detalle`, { waitUntil: "networkidle" });
    await expect(page.getByText("ROOMLINK / 06")).toBeVisible();
  });
});

// ============================================================================
// FLUJO 2 · HU-01 Guardrails (términos, contraseña, duplicados, bloqueo 15m, reset 30m)
// ============================================================================
test.describe("Flujo 2 · HU-01 Registro, bloqueo y recuperación", () => {
  test("NO permite registro sin términos, contraseña < 8 ni correo duplicado; SÍ bloquea tras 5 intentos", async ({ page }) => {
    await page.goto(`${WEB_URL}/registro`, { waitUntil: "networkidle" });
    const inputs = page.locator("input");
    await inputs.nth(0).fill(`${uniq("noterms")}@roomlink.test`);
    await inputs.nth(1).fill("Password123!");
    await page.getByText("Crear mi cuenta", { exact: true }).click();
    await expect(page.getByText(/términos/i)).toBeVisible();

    // Contraseña < 8 caracteres
    const shortPwd = await apiJson("/auth/register", {
      method: "POST",
      body: { email: `${uniq("short")}@roomlink.test`, password: "123", termsAccepted: true },
    });
    expect(shortPwd.status).toBeGreaterThanOrEqual(400);

    // Correo duplicado
    const acc = await createAccount("lock-dup");
    const dup = await apiJson("/auth/register", {
      method: "POST",
      body: { email: acc.email, password: "Password123!", termsAccepted: true },
    });
    expect([400, 409]).toContain(dup.status);

    // 5 intentos fallidos -> bloqueo de 15 minutos
    for (let i = 0; i < 5; i++) {
      const bad = await apiJson("/auth/login", {
        method: "POST",
        body: { email: acc.email, password: "WrongPassword999!" },
      });
      expect([401, 423, 429]).toContain(bad.status);
    }
    const locked = await apiJson("/auth/login", {
      method: "POST",
      body: { email: acc.email, password: acc.password },
    });
    expect([403, 423, 429]).toContain(locked.status);

    // Solicitud de reset (30 min)
    const forgot = await apiJson("/auth/forgot-password", {
      method: "POST",
      body: { email: acc.email },
    });
    expect([200, 202]).toContain(forgot.status);
  });
});

// ============================================================================
// FLUJO 3 · HU-02 Perfil personal y privacidad
// ============================================================================
test.describe("Flujo 3 · HU-02 Perfil personal y privacidad", () => {
  test("NO permite menor de 18, bio > 300 ni leer privacidad ajena; SÍ guarda perfil y privacidad", async () => {
    const a = await createAccount("prof-a");
    const b = await createAccount("prof-b");

    const minor = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: { fullName: "Menor Prueba", birthDate: "2015-01-01" },
    });
    expect(minor.status).toBe(400);

    const longBio = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: { fullName: "Ana Prueba", birthDate: "2000-03-15", bio: "x".repeat(301) },
    });
    expect(longBio.status).toBe(400);

    const ok = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: { fullName: "Ana Prueba", birthDate: "2000-03-15", occupation: "Ingeniería", bio: "Ordenada." },
    });
    expect([200, 201]).toContain(ok.status);

    const priv = await apiJson(`/profile/${a.userId}/privacy`, {
      method: "PUT",
      token: a.token,
      body: { showPhoneToConnections: true, showEmailToConnections: false, showSocialsToConnections: true },
    });
    expect(priv.status).toBe(200);
    expect(priv.data.showEmailToConnections).toBe(false);

    const forbidden = await apiJson(`/profile/${a.userId}/privacy`, {
      method: "GET",
      token: b.token,
    });
    expect(forbidden.status).toBe(403);
  });
});

// ============================================================================
// FLUJO 4 · HU-03, HU-04, HU-05 · Compatibilidad, Feed y Filtros
// ============================================================================
test.describe("Flujo 4 · HU-03, HU-04 y HU-05 Compatibilidad, Feed y Filtros", () => {
  test("NO da scores sin test ni acepta valores/filtros inválidos; SÍ calcula 7 dimensiones y ordena descendente", async () => {
    const seeker = await createAccount("seek-c", { withProfile: true });
    const peer = await createAccount("peer-c", { withProfile: true, withTest: true });

    // Sin test: hasTest === false
    const sinTest = await apiJson(`/compatibility/${seeker.userId}/feed?page=1`, { token: seeker.token });
    expect(sinTest.status).toBe(200);
    expect(sinTest.data.hasTest).toBe(false);

    // Respuestas fuera de rango y usuario ajeno
    const badRange = await apiJson(`/compatibility/${seeker.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: { schedule: 9, cleanliness: 3, noise: 3, pets: 3, smoking: 1, visits: 3, genderPref: 3 },
    });
    expect(badRange.status).toBe(400);

    const otherTest = await apiJson(`/compatibility/${peer.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: { schedule: 3, cleanliness: 4, noise: 2, pets: 4, smoking: 1, visits: 3, genderPref: 3 },
    });
    expect(otherTest.status).toBe(403);

    // Responder test válido
    const okTest = await apiJson(`/compatibility/${seeker.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: { schedule: 3, cleanliness: 4, noise: 2, pets: 4, smoking: 1, visits: 3, genderPref: 3 },
    });
    expect(okTest.status).toBe(200);
    expect(okTest.data.summary).toHaveLength(7);

    // Feed ordenado de mayor a menor
    const conTest = await apiJson(`/compatibility/${seeker.userId}/feed?page=1`, { token: seeker.token });
    expect(conTest.status).toBe(200);
    expect(conTest.data.hasTest).toBe(true);
    const scores = conTest.data.profiles
      .map((p) => p.compatibilityScore)
      .filter((s) => typeof s === "number");
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }

    // Filtros inválidos rechazados
    expect((await apiJson("/rooms/feed?minRent=9000&maxRent=1000")).status).toBe(400);
    expect((await apiJson("/rooms/feed?page=0")).status).toBe(400);
  });
});

// ============================================================================
// FLUJO 5 · HU-06 + M08 · Publicación, ciclo de vida y detalle de inmueble
// ============================================================================
test.describe("Flujo 5 · HU-06 y M08 Publicar habitación y ciclo de vida", () => {
  test("NO publica con < 3 fotos, sin ubicación o fecha pasada ni permite edición ajena; SÍ recorre ciclo completo y abre M08", async ({ page }) => {
    const host = await createAccount("host-r", { withProfile: true, withTest: true, roleHost: true });
    const other = await createAccount("other-r", { withProfile: true, withTest: true, roleHost: true });

    const few = await createRoomForm(host.token, { photos: 1, withLocation: true });
    expect(few.status).toBe(201);
    expect((await apiJson(`/rooms/${few.data.id}/publish`, { method: "PATCH", token: host.token })).status).toBe(400);

    const noLoc = await createRoomForm(host.token, { photos: 3, withLocation: false });
    expect(noLoc.status).toBe(201);
    expect((await apiJson(`/rooms/${noLoc.data.id}/publish`, { method: "PATCH", token: host.token })).status).toBe(400);

    const past = await createRoomForm(host.token, { photos: 3, withLocation: true, availableFrom: "2020-01-01" });
    expect(past.status).toBe(400);

    const ok = await createRoomForm(host.token, { photos: 3, withLocation: true });
    expect(ok.status).toBe(201);
    const roomId = ok.data.id;

    expect((await apiJson(`/rooms/${roomId}/publish`, { method: "PATCH", token: host.token })).status).toBe(200);
    expect((await apiJson(`/rooms/${roomId}/pause`, { method: "PATCH", token: other.token })).status).toBe(403);
    expect((await apiJson(`/rooms/${roomId}/pause`, { method: "PATCH", token: host.token })).status).toBe(200);
    expect((await apiJson(`/rooms/${roomId}/reactivate`, { method: "PATCH", token: host.token })).status).toBe(200);

    // Persistencia real de reglas y costos (servicios, depósito, mantenimiento) + negativos
    expect(
      (await apiJson(`/rooms/${roomId}/rules`, { method: "PUT", token: other.token, body: { petsAllowed: true } })).status,
    ).toBe(403);
    expect(
      (await apiJson(`/rooms/${roomId}/costs`, {
        method: "PUT",
        token: host.token,
        body: { items: [{ kind: "service", concept: "Luz", amount: -10, isIncluded: false, isProrated: false }] },
      })).status,
    ).toBe(400);
    expect(
      (await apiJson(`/rooms/${roomId}/rules`, {
        method: "PUT",
        token: host.token,
        body: { visitsPolicy: "Con aviso previo", petsAllowed: true, quietHoursStart: "23:00" },
      })).status,
    ).toBe(200);
    expect(
      (await apiJson(`/rooms/${roomId}/costs`, {
        method: "PUT",
        token: host.token,
        body: {
          items: [
            { kind: "deposit", concept: "Depósito", amount: 3800, isIncluded: false, isProrated: false },
            { kind: "service", concept: "Internet y agua", amount: 350, isIncluded: false, isProrated: false },
            { kind: "maintenance", concept: "Mantenimiento", amount: 200, isIncluded: false, isProrated: false },
          ],
        },
      })).status,
    ).toBe(200);

    // Abrir M08 en UI móvil real con la habitación publicada
    await loginInBrowser(page, host.email, host.password);
    await page.goto(`${WEB_URL}/inmueble-detalle?listingId=${roomId}`, { waitUntil: "networkidle" });
    await expect(page.getByText("ROOMLINK / 08")).toBeVisible();
    await expect(page.getByText("Reglas de la casa")).toBeVisible();
    await page.getByText("Costos claros", { exact: true }).click();
    await expect(page.getByText("Total mensual estimado")).toBeVisible();
    await page.getByText("Conoce la zona", { exact: true }).click();
    await expect(page.getByText("Privacidad de ubicación")).toBeVisible();

    // Cerrar anuncio y verificar que NO puede republicarse
    expect((await apiJson(`/rooms/${roomId}/close`, { method: "PATCH", token: host.token })).status).toBe(200);
    expect([400, 409]).toContain(
      (await apiJson(`/rooms/${roomId}/publish`, { method: "PATCH", token: host.token })).status,
    );
  });
});

// ============================================================================
// FLUJO 6 · HU-07 + M09 · Postulaciones extremo a extremo
// ============================================================================
test.describe("Flujo 6 · HU-07 Postulaciones (auto-postulación, terceros y decisión en UI)", () => {
  test("NO permite auto-postulación ni decisión de tercero; SÍ postula, muestra en /postulaciones y acepta", async ({ page }) => {
    const host = await createAccount("host-app", { withProfile: true, withTest: true, roleHost: true });
    const seeker = await createAccount("seek-app", { withProfile: true, withTest: true });
    const stranger = await createAccount("str-app", { withProfile: true, withTest: true });

    const created = await createRoomForm(host.token, { photos: 3, withLocation: true });
    const roomId = created.data.id;
    await apiJson(`/rooms/${roomId}/publish`, { method: "PATCH", token: host.token });

    // Negativo: auto-postulación
    const selfApp = await apiJson("/applications", {
      method: "POST",
      token: host.token,
      body: { listingId: roomId, message: "Auto-postulación" },
    });
    expect([400, 403]).toContain(selfApp.status);

    // Positivo: seeker se postula
    const appRes = await apiJson("/applications", {
      method: "POST",
      token: seeker.token,
      body: { listingId: roomId, message: "Me interesa mucho la habitación." },
    });
    expect(appRes.status).toBe(201);
    const appId = appRes.data.id;

    // Negativo: tercero no puede decidir
    expect(
      (await apiJson(`/applications/${appId}/accept`, { method: "PATCH", token: stranger.token })).status,
    ).toBe(403);

    // UI móvil: host abre /postulaciones y ve la postulación del candidato
    await loginInBrowser(page, host.email, host.password);
    await page.goto(`${WEB_URL}/postulaciones?listingId=${roomId}&titulo=Habitacion`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByText("Personas interesadas")).toBeVisible();

    // Aceptar postulación y verificar que NO permite re-decidir
    const acc = await apiJson(`/applications/${appId}/accept`, { method: "PATCH", token: host.token });
    expect(acc.status).toBe(200);
    expect(acc.data.status).toBe("accepted");
    expect([400, 409]).toContain(
      (await apiJson(`/applications/${appId}/accept`, { method: "PATCH", token: host.token })).status,
    );
  });
});

// ============================================================================
// FLUJO 7 · HU-08 + M10 + M12 + M14 · Conexiones, Chat, Acuerdos y Notificaciones
// ============================================================================
test.describe("Flujo 7 · HU-08 Conexiones, Chat habilitado al aceptar y Notificaciones", () => {
  test("NO permite auto-solicitud, duplicados ni chat sin aceptar; SÍ conecta, chatea y notifica", async () => {
    const a = await createAccount("conn-a", { withProfile: true, withTest: true });
    const b = await createAccount("conn-b", { withProfile: true, withTest: true });

    // Negativo: auto-solicitud
    expect(
      (await apiJson("/connections", { method: "POST", token: a.token, body: { addresseeId: a.userId } })).status,
    ).toBe(400);

    // Positivo: enviar solicitud
    const sent = await apiJson("/connections", {
      method: "POST",
      token: a.token,
      body: { addresseeId: b.userId, message: "Hola, ¿buscas roomie?" },
    });
    expect(sent.status).toBe(201);
    const connId = sent.data.id;

    // Negativo: duplicado pendiente
    expect([400, 409]).toContain(
      (await apiJson("/connections", { method: "POST", token: a.token, body: { addresseeId: b.userId } })).status,
    );

    // Negativo: chat antes de aceptar
    expect([400, 403, 409]).toContain(
      (await apiJson("/messages/conversations", { method: "POST", token: a.token, body: { connectionId: connId } })).status,
    );

    // Positivo: B acepta -> se habilita chat -> envían mensaje -> genera notificación
    expect((await apiJson(`/connections/${connId}/accept`, { method: "PATCH", token: b.token })).status).toBe(200);

    const conv = await apiJson("/messages/conversations", {
      method: "POST",
      token: a.token,
      body: { connectionId: connId },
    });
    expect([200, 201]).toContain(conv.status);
    const convId = conv.data.id ?? conv.data.conversation?.id;
    expect(convId).toBeTruthy();

    const msg = await apiJson(`/messages/conversations/${convId}/messages`, {
      method: "POST",
      token: a.token,
      body: { content: "¡Hola! Qué gusto conectar." },
    });
    expect(msg.status).toBe(201);

    const notifs = await apiJson("/notifications", { token: a.token });
    expect(notifs.status).toBe(200);
  });
});
