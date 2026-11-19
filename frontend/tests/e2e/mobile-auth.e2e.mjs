// E2E del cliente móvil (React Native Web) contra el backend REAL.
//
// Verifica lo que un smoke por curl NO puede: que el navegador (cliente real)
// pueda consumir la API cross-origin — CORS + credenciales + Bearer token —
// y completar el login hasta la pantalla autenticada, y que la navegación por
// pestañas (post-unificación en Room_Link) funcione sin barra duplicada.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Click por texto EXACTO sobre un elemento visible (pestañas, botones).
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

// Navegación profunda robusta: los <Link href> de expo-router renderizan <a href>
// en web. Clickear el <a> por su ruta es más fiable que por texto.
const clickHref = (page, route) =>
  page.evaluate((r) => {
    const a = [...document.querySelectorAll("a")].find((x) => {
      const h = x.getAttribute("href") || "";
      return (h === r || h.endsWith(r)) && x.offsetParent !== null;
    });
    if (a) {
      a.click();
      return true;
    }
    return false;
  }, route);

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

test("móvil: login real cross-origin + navegación por pestañas (Room_Link unificado)", async () => {
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
    await sleep(900);

    // Login
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

    // Aterriza en Mis publicaciones (M07) — prueba que el login cross-origin se completó.
    await page.waitForFunction(
      () => document.body.innerText.includes("Mis publicaciones"),
      { timeout: 15000 },
    );
    assert.equal(
      loginStatus,
      200,
      "POST /auth/login debe responder 200 en el navegador (valida CORS + credenciales)",
    );

    // Navegación: una sola barra de pestañas (sin duplicado).
    const navCount = await page.evaluate(
      () =>
        [...document.querySelectorAll("*")].filter(
          (e) => (e.textContent || "").trim() === "Descubrir" && e.offsetParent,
        ).length,
    );
    assert.equal(navCount, 1, `Se esperaba una sola barra de nav, hay ${navCount}`);

    // Tabs (hermanos): se navegan primero porque las pantallas apiladas
    // (p.ej. /buscar-roomies, con botón "‹ Volver") no muestran la barra de pestañas.

    // Tab Chats — bandeja real (HU-10)
    await clickByText(page, "Chats");
    await page.waitForFunction(
      () => document.body.innerText.includes("Tus conversaciones"),
      { timeout: 10000 },
    );

    // Tab Perfil — perfil extendido (M02, módulo de Roberto)
    await clickByText(page, "Perfil");
    await page.waitForFunction(
      () => document.body.innerText.includes("Mi perfil"),
      { timeout: 10000 },
    );

    // Tab Descubrir — feed de habitaciones (M04 / HU-04)
    await clickByText(page, "Descubrir");
    await page.waitForFunction(
      () => document.body.innerText.includes("Encuentra tu habitación"),
      { timeout: 10000 },
    );

    // Pantalla apilada final: Búsqueda de roomies (M05, módulo de Roberto)
    assert.ok(
      await clickHref(page, "/buscar-roomies"),
      "Debe existir el enlace a /buscar-roomies desde Descubrir",
    );
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Buscar roomies") &&
        document.body.innerText.includes("Filtros generales"),
      { timeout: 10000 },
    );
  } finally {
    await browser.close();
  }
});
