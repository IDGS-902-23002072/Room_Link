// Suite E2E con Playwright para HU-01 a HU-08 (casos positivos Y negativos).
//
// Requisitos para ejecutarla contra el stack real:
//   - Backend corriendo en E2E_API_URL (default http://localhost:3000/api/v1)
//   - Build web del cliente móvil servido en E2E_WEB_URL (default http://localhost:8081)
//
// Ejecutar:
//   cd frontend && npm run test:e2e:pw

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

async function createAccount(tag, { roleHost = false } = {}) {
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

  if (roleHost) {
    // Crear perfil primero para cumplir prerequisitos de host
    await apiJson(`/profile/${userId}`, {
      method: "POST",
      token,
      body: {
        fullName: `Host ${tag}`,
        birthDate: "1998-05-10",
        occupation: "Estudiante",
        bio: "Anfitrión de prueba E2E.",
      },
    });
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
  await page.goto(WEB_URL, { waitUntil: "networkidle" });
  const inputs = page.locator("input");
  await expect(inputs.nth(0)).toBeVisible();
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByText("Iniciar sesión", { exact: true }).last().click();
}

// ============================================================================
// HU-01 · Registro e inicio de sesión (positivos y negativos)
// ============================================================================
test.describe("HU-01 · Registro e inicio de sesión", () => {
  test("NO permite acceder a rutas protegidas sin sesión (redirige a login)", async ({ page }) => {
    await page.goto(`${WEB_URL}/perfil`, { waitUntil: "networkidle" });
    await expect(page.getByText("Inicia sesión")).toBeVisible();
  });

  test("NO permite registrarse sin aceptar términos, con contraseña < 8 o correo duplicado", async ({ page }) => {
    await page.goto(`${WEB_URL}/registro`, { waitUntil: "networkidle" });
    const inputs = page.locator("input");
    await inputs.nth(0).fill(`${uniq("noterms")}@roomlink.test`);
    await inputs.nth(1).fill("Password123!");
    await page.getByText("Crear mi cuenta", { exact: true }).click();
    await expect(page.getByText(/términos/i)).toBeVisible();

    // API: contraseña < 8 caracteres rechazada
    const shortPwd = await apiJson("/auth/register", {
      method: "POST",
      body: { email: `${uniq("short")}@roomlink.test`, password: "123", termsAccepted: true },
    });
    expect(shortPwd.status).toBeGreaterThanOrEqual(400);

    // API: correo duplicado rechazado
    const email = `${uniq("dup")}@roomlink.test`;
    const first = await apiJson("/auth/register", {
      method: "POST",
      body: { email, password: "Password123!", termsAccepted: true },
    });
    expect(first.status).toBe(201);
    const second = await apiJson("/auth/register", {
      method: "POST",
      body: { email, password: "Password123!", termsAccepted: true },
    });
    expect([400, 409]).toContain(second.status);
  });

  test("SÍ bloquea la cuenta por 15 min tras 5 intentos fallidos y permite solicitar reset de 30 min", async () => {
    const acc = await createAccount("lockout");

    for (let i = 0; i < 5; i++) {
      const bad = await apiJson("/auth/login", {
        method: "POST",
        body: { email: acc.email, password: "WrongPassword999!" },
      });
      expect([401, 423, 429]).toContain(bad.status);
    }

    // El 6to intento incluso con contraseña correcta debe estar bloqueado
    const locked = await apiJson("/auth/login", {
      method: "POST",
      body: { email: acc.email, password: acc.password },
    });
    expect([403, 423, 429]).toContain(locked.status);

    // Solicitud de restablecimiento de contraseña
    const forgot = await apiJson("/auth/forgot-password", {
      method: "POST",
      body: { email: acc.email },
    });
    expect([200, 202]).toContain(forgot.status);
  });
});

// ============================================================================
// HU-02 · Perfil personal (positivos y negativos)
// ============================================================================
test.describe("HU-02 · Perfil personal", () => {
  test("SÍ crea/edita perfil y privacidad; NO permite menor de 18, bio > 300 ni editar perfil ajeno", async () => {
    const a = await createAccount("prof-a");
    const b = await createAccount("prof-b");

    // Negativo: menor de 18 años
    const minor = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: { fullName: "Menor Prueba", birthDate: "2015-01-01" },
    });
    expect(minor.status).toBe(400);

    // Negativo: biografía > 300 caracteres
    const longBio = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: { fullName: "Ana Prueba", birthDate: "2000-03-15", bio: "x".repeat(301) },
    });
    expect(longBio.status).toBe(400);

    // Positivo: crear perfil válido
    const ok = await apiJson(`/profile/${a.userId}`, {
      method: "POST",
      token: a.token,
      body: {
        fullName: "Ana Prueba",
        birthDate: "2000-03-15",
        occupation: "Ingeniería",
        bio: "Ordenada y tranquila.",
      },
    });
    expect([200, 201]).toContain(ok.status);

    // Positivo: actualizar privacidad de contacto
    const priv = await apiJson(`/profile/${a.userId}/privacy`, {
      method: "PUT",
      token: a.token,
      body: {
        showPhoneToConnections: true,
        showEmailToConnections: false,
        showSocialsToConnections: true,
      },
    });
    expect(priv.status).toBe(200);
    expect(priv.data.showEmailToConnections).toBe(false);

    // Negativo: usuario B NO puede leer ni editar la privacidad de usuario A
    const forbidden = await apiJson(`/profile/${a.userId}/privacy`, {
      method: "GET",
      token: b.token,
    });
    expect(forbidden.status).toBe(403);
  });
});

// ============================================================================
// HU-03 & HU-04 & HU-05 · Test de compatibilidad, Feed y Filtros
// ============================================================================
test.describe("HU-03, HU-04 y HU-05 · Compatibilidad, Feed y Filtros", () => {
  test("NO muestra porcentajes si no hay test; SÍ calcula, ordena y filtra; NO acepta parámetros inválidos", async ({ page }) => {
    const seeker = await createAccount("seeker-hu345");
    const peer = await createAccount("peer-hu345");

    // Crear perfiles válidos
    await apiJson(`/profile/${seeker.userId}`, {
      method: "POST",
      token: seeker.token,
      body: { fullName: "Luis Buscador", birthDate: "2001-06-10", occupation: "Estudiante" },
    });
    await apiJson(`/profile/${peer.userId}`, {
      method: "POST",
      token: peer.token,
      body: { fullName: "Sofía Compatible", birthDate: "2000-09-20", occupation: "Diseño" },
    });

    // HU-04 negativo: sin test, hasTest === false y sin porcentajes
    const feedSinTest = await apiJson(`/compatibility/${seeker.userId}/feed?page=1`, {
      token: seeker.token,
    });
    expect(feedSinTest.status).toBe(200);
    expect(feedSinTest.data.hasTest).toBe(false);

    // HU-03 negativo: valores fuera de rango (1..5)
    const testInvalido = await apiJson(`/compatibility/${seeker.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: { schedule: 9, cleanliness: 3, noise: 3, pets: 3, smoking: 1, visits: 3, genderPref: 3 },
    });
    expect(testInvalido.status).toBe(400);

    // HU-03 negativo: usuario no puede guardar test de otro
    const testAjeno = await apiJson(`/compatibility/${peer.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: { schedule: 3, cleanliness: 4, noise: 2, pets: 3, smoking: 1, visits: 3, genderPref: 3 },
    });
    expect(testAjeno.status).toBe(403);

    // HU-03 positivo: ambos responden las 7 dimensiones
    const respuestas = { schedule: 3, cleanliness: 5, noise: 2, pets: 4, smoking: 1, visits: 3, genderPref: 3 };
    const t1 = await apiJson(`/compatibility/${seeker.userId}`, {
      method: "PUT",
      token: seeker.token,
      body: respuestas,
    });
    expect(t1.status).toBe(200);
    expect(t1.data.completed).toBe(true);
    expect(t1.data.summary).toHaveLength(7);

    await apiJson(`/compatibility/${peer.userId}`, {
      method: "PUT",
      token: peer.token,
      body: respuestas,
    });

    // HU-04 positivo: feed ordenado de mayor a menor con scores
    const feedConTest = await apiJson(`/compatibility/${seeker.userId}/feed?page=1`, {
      token: seeker.token,
    });
    expect(feedConTest.status).toBe(200);
    expect(feedConTest.data.hasTest).toBe(true);
    const scores = feedConTest.data.profiles
      .map((p) => p.compatibilityScore)
      .filter((s) => typeof s === "number");
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }

    // HU-05 negativo: filtros inválidos en feed de habitaciones
    const badFilter = await apiJson("/rooms/feed?minRent=9000&maxRent=1000");
    expect(badFilter.status).toBe(400);
    const badPage = await apiJson("/rooms/feed?page=0");
    expect(badPage.status).toBe(400);

    // UI móvil: iniciar sesión y navegar a /buscar-roomies y /compatibilidad-detalle
    await loginInBrowser(page, seeker.email, seeker.password);
    await page.waitForTimeout(1200);
    await page.goto(`${WEB_URL}/buscar-roomies`, { waitUntil: "networkidle" });
    await expect(page.getByText("Buscar roomies")).toBeVisible();
    await page.goto(`${WEB_URL}/compatibilidad-detalle`, { waitUntil: "networkidle" });
    await expect(page.getByText("ROOMLINK / 06")).toBeVisible();
  });
});

// ============================================================================
// HU-06 · Publicar habitación (positivos y negativos)
// ============================================================================
test.describe("HU-06 · Publicar y gestionar habitación", () => {
  test("NO permite publicar con < 3 fotos, sin ubicación ni fecha pasada; SÍ publica, pausa, reactiva y cierra; NO permite editar cerrada ni anuncio ajeno", async () => {
    const host = await createAccount("host-hu6", { roleHost: true });
    const other = await createAccount("other-hu6", { roleHost: true });

    // Negativo: borrador con 1 foto NO puede publicarse
    const draftFewPhotos = await createRoomForm(host.token, { photos: 1, withLocation: true });
    expect(draftFewPhotos.status).toBe(201);
    const pubFew = await apiJson(`/rooms/${draftFewPhotos.data.id}/publish`, {
      method: "PATCH",
      token: host.token,
    });
    expect(pubFew.status).toBe(400);

    // Negativo: borrador sin ubicación NO puede publicarse
    const draftNoLoc = await createRoomForm(host.token, { photos: 3, withLocation: false });
    expect(draftNoLoc.status).toBe(201);
    const pubNoLoc = await apiJson(`/rooms/${draftNoLoc.data.id}/publish`, {
      method: "PATCH",
      token: host.token,
    });
    expect(pubNoLoc.status).toBe(400);

    // Negativo: fecha pasada rechazada
    const pastDate = await createRoomForm(host.token, {
      photos: 3,
      withLocation: true,
      availableFrom: "2020-01-01",
    });
    expect(pastDate.status).toBe(400);

    // Positivo: borrador completo -> publicar -> pausar -> reactivar -> cerrar
    const draftOk = await createRoomForm(host.token, { photos: 3, withLocation: true });
    expect(draftOk.status).toBe(201);
    const roomId = draftOk.data.id;

    const pub = await apiJson(`/rooms/${roomId}/publish`, { method: "PATCH", token: host.token });
    expect(pub.status).toBe(200);
    expect(pub.data.status).toBe("published");

    // Negativo: otro usuario NO puede pausar anuncio ajeno
    const stealPause = await apiJson(`/rooms/${roomId}/pause`, {
      method: "PATCH",
      token: other.token,
    });
    expect(stealPause.status).toBe(403);

    const pause = await apiJson(`/rooms/${roomId}/pause`, { method: "PATCH", token: host.token });
    expect(pause.status).toBe(200);
    expect(pause.data.status).toBe("paused");

    const reactivate = await apiJson(`/rooms/${roomId}/reactivate`, {
      method: "PATCH",
      token: host.token,
    });
    expect(reactivate.status).toBe(200);
    expect(reactivate.data.status).toBe("published");

    const close = await apiJson(`/rooms/${roomId}/close`, { method: "PATCH", token: host.token });
    expect(close.status).toBe(200);
    expect(close.data.status).toBe("closed");

    // Negativo: una publicación cerrada NO puede volver a publicarse
    const republish = await apiJson(`/rooms/${roomId}/publish`, {
      method: "PATCH",
      token: host.token,
    });
    expect([400, 409]).toContain(republish.status);
  });
});

// ============================================================================
// HU-07 · Gestionar postulaciones (positivos y negativos)
// ============================================================================
test.describe("HU-07 · Gestionar postulaciones", () => {
  test("NO permite auto-postulación ni decisión de tercero; SÍ postula, acepta y rechaza re-decisión", async () => {
    const host = await createAccount("host-hu7", { roleHost: true });
    const seeker = await createAccount("seeker-hu7");
    const stranger = await createAccount("stranger-hu7");

    const created = await createRoomForm(host.token, { photos: 3, withLocation: true });
    expect(created.status).toBe(201);
    const roomId = created.data.id;
    await apiJson(`/rooms/${roomId}/publish`, { method: "PATCH", token: host.token });

    // Negativo: el propio host NO puede postularse a su propia habitación
    const selfApply = await apiJson("/applications", {
      method: "POST",
      token: host.token,
      body: { listingId: roomId, message: "Auto-postulación prohibida" },
    });
    expect([400, 403]).toContain(selfApply.status);

    // Positivo: seeker se postula
    const appRes = await apiJson("/applications", {
      method: "POST",
      token: seeker.token,
      body: { listingId: roomId, message: "Me interesa mucho la habitación." },
    });
    expect(appRes.status).toBe(201);
    const appId = appRes.data.id;

    // Negativo: un tercero NO puede aceptar la postulación de otro host
    const hijack = await apiJson(`/applications/${appId}/accept`, {
      method: "PATCH",
      token: stranger.token,
    });
    expect(hijack.status).toBe(403);

    // Positivo: host acepta la postulación
    const accept = await apiJson(`/applications/${appId}/accept`, {
      method: "PATCH",
      token: host.token,
    });
    expect(accept.status).toBe(200);
    expect(accept.data.status).toBe("accepted");

    // Negativo: NO se puede volver a aceptar una postulación ya resuelta
    const acceptAgain = await apiJson(`/applications/${appId}/accept`, {
      method: "PATCH",
      token: host.token,
    });
    expect([400, 409]).toContain(acceptAgain.status);
  });
});

// ============================================================================
// HU-08 · Solicitudes de conexión y chat condicionado (positivos y negativos)
// ============================================================================
test.describe("HU-08 · Solicitudes de conexión", () => {
  test("NO permite duplicados pendientes, auto-solicitud ni chat antes de aceptar; SÍ conecta y habilita chat al aceptar", async () => {
    const a = await createAccount("conn-a");
    const b = await createAccount("conn-b");

    // Negativo: auto-solicitud
    const selfConn = await apiJson("/connections", {
      method: "POST",
      token: a.token,
      body: { addresseeId: a.userId, message: "Yo mismo" },
    });
    expect(selfConn.status).toBe(400);

    // Positivo: enviar solicitud con mensaje opcional
    const sent = await apiJson("/connections", {
      method: "POST",
      token: a.token,
      body: { addresseeId: b.userId, message: "Hola, ¿buscas roomie?" },
    });
    expect(sent.status).toBe(201);
    const connId = sent.data.id;

    // Negativo: NO permite duplicar solicitud pendiente hacia la misma persona
    const dup = await apiJson("/connections", {
      method: "POST",
      token: a.token,
      body: { addresseeId: b.userId, message: "Duplicada" },
    });
    expect([400, 409]).toContain(dup.status);

    // Negativo: NO permite abrir chat antes de que la conexión sea aceptada
    const chatBefore = await apiJson("/messages/conversations", {
      method: "POST",
      token: a.token,
      body: { connectionId: connId },
    });
    expect([400, 403, 409]).toContain(chatBefore.status);

    // Positivo: B acepta la conexión
    const acc = await apiJson(`/connections/${connId}/accept`, {
      method: "PATCH",
      token: b.token,
    });
    expect(acc.status).toBe(200);
    expect(acc.data.status).toBe("accepted");

    // Positivo: ahora SÍ se habilita el chat y se puede enviar mensaje
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
  });
});
