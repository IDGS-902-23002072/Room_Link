// E2E del cliente móvil (React Native Web) contra el backend REAL.
//
// Verifica lo que un smoke por curl NO puede: que el navegador (cliente real)
// pueda consumir la API cross-origin — CORS + credenciales + Bearer token —
// y completar el login hasta la pantalla autenticada.
//
// Requisitos (los orquesta el workflow de CI o el script local):
//   - Backend corriendo y accesible en E2E_API_URL  (default http://localhost:3000/api/v1)
//   - Build web del móvil servido en E2E_WEB_URL     (default http://localhost:8081)
//   - Un Chrome/Chromium en CHROME_PATH              (default /usr/bin/google-chrome)
//
// Correr: node --test tests/e2e/*.e2e.mjs   (o: npm run test:e2e)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:8081";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api/v1";

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? "/usr/bin/google-chrome";
}

const CHROME_PATH = resolveChromePath();

const clickByText = (page, label) =>
  page.evaluate((t) => {
    const nodes = [
      ...document.querySelectorAll("div,span,a,button,[role=button],[role=link]"),
    ];
    const hit = nodes
      .reverse()
      .find((e) => (e.textContent || "").trim() === t && e.offsetParent !== null);
    if (hit) {
      hit.click();
      return true;
    }
    return false;
  }, label);

async function registerTestUser() {
  const email = `e2e-${Date.now()}@roomlink.test`;
  const password = "E2e-Test-1234!";
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, termsAccepted: true }),
  });
  assert.equal(
    res.status,
    201,
    `El backend debe estar accesible y registrar al usuario de prueba (status ${res.status})`,
  );
  return { email, password };
}

test("móvil: login real cross-origin y llegada a la pantalla autenticada", async () => {
  const { email, password } = await registerTestUser();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    let loginStatus = null;
    page.on("requestfinished", (req) => {
      if (req.url().endsWith("/api/v1/auth/login") && req.method() === "POST") {
        loginStatus = req.response()?.status() ?? null;
      }
    });

    await page.goto(WEB_URL, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));

    const inputs = await page.$$("input");
    assert.ok(
      inputs.length >= 2,
      "La pantalla inicial debe mostrar los campos de correo y contraseña",
    );
    await inputs[0].type(email, { delay: 5 });
    await inputs[1].type(password, { delay: 5 });

    const clicked =
      (await clickByText(page, "Entrar")) ||
      (await clickByText(page, "Iniciar sesión"));
    assert.ok(clicked, "Debe existir el botón 'Entrar' o 'Iniciar sesión'");

    // La llegada a las pestañas autenticadas prueba que el login cross-origin se completó.
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Tus conversaciones") ||
        document.body.innerText.includes("Chats") ||
        document.body.innerText.includes("Anuncios") ||
        document.body.innerText.includes("Descubrir"),
      { timeout: 15000 },
    );

    assert.equal(
      loginStatus,
      200,
      "POST /auth/login debe responder 200 en el navegador (valida CORS + credenciales)",
    );

    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      bodyText.includes("Tus conversaciones") ||
        bodyText.includes("Chats") ||
        bodyText.includes("Anuncios") ||
        bodyText.includes("Descubrir"),
      "Tras el login se debe ver la pantalla autenticada",
    );

    // Navegar al tab Chats y verificar que carga la bandeja real de HU-10
    await clickByText(page, "Chats");
    await page.waitForFunction(
      () => document.body.innerText.includes("Tus conversaciones"),
      { timeout: 10000 },
    );

    // Navegar al tab Perfil y verificar los enlaces a Notificaciones, Conexiones y Acuerdos
    await clickByText(page, "Perfil");
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Mi perfil") &&
        document.body.innerText.includes("Centro de notificaciones (HU-14)") &&
        document.body.innerText.includes("Solicitudes de conexión") &&
        document.body.innerText.includes("Acuerdos de convivencia (HU-12)"),
      { timeout: 10000 },
    );

    // Abrir el Centro de Notificaciones (HU-14) y verificar que carga notificaciones y permisos del sistema
    await clickByText(page, "Centro de notificaciones (HU-14)");
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("ROOMLINK / 14") &&
        document.body.innerText.includes("Notificaciones del sistema"),
      { timeout: 10000 },
    );

    // Volver a Perfil y abrir Solicitudes de conexión
    await clickByText(page, "‹");
    await page.waitForFunction(
      () => document.body.innerText.includes("Solicitudes de conexión"),
      { timeout: 10000 },
    );
    await clickByText(page, "Solicitudes de conexión");
    await page.waitForFunction(
      () => document.body.innerText.includes("ROOMLINK / CONEXIONES"),
      { timeout: 10000 },
    );

    // Volver a Perfil y abrir Acuerdos de convivencia (HU-12)
    await clickByText(page, "‹");
    await page.waitForFunction(
      () => document.body.innerText.includes("Acuerdos de convivencia (HU-12)"),
      { timeout: 10000 },
    );
    await clickByText(page, "Acuerdos de convivencia (HU-12)");
    await page.waitForFunction(
      () => document.body.innerText.includes("ROOMLINK / 12"),
      { timeout: 10000 },
    );
  } finally {
    await browser.close();
  }
});
