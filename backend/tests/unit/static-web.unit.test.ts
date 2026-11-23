import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

// serveStatic resuelve ./public contra el cwd del proceso, igual que en la VM
// (WorkingDirectory=/opt/roomlink/current). Vitest usa forks, así que chdir es seguro.
describe("sitio web estático (web/ Vite) servido por la API", () => {
  const originalCwd = process.cwd();
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "roomlink-public-"));
    mkdirSync(join(root, "public", "assets"), { recursive: true });
    mkdirSync(join(root, "public", "descargas"), { recursive: true });
    writeFileSync(join(root, "public", "index.html"), "<!doctype html><div id=root>SPA</div>");
    writeFileSync(join(root, "public", "assets", "app.js"), "console.log('vite')");
    // Restos de una exportación Expo: no deben servirse por rewrite .html.
    writeFileSync(join(root, "public", "login.html"), "EXPO-LOGIN");
    writeFileSync(join(root, "public", "descargas", "roomlink.apk"), "APK-BYTES");
    process.chdir(root);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it("sirve los assets del build tal cual", async () => {
    const response = await createApp().request("/assets/app.js");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("console.log('vite')");
  });

  it("resuelve rutas de BrowserRouter a index.html", async () => {
    const response = await createApp().request("/dashboard/usuarios");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("SPA");
  });

  it("no reescribe rutas a archivos .html (comportamiento de Expo retirado)", async () => {
    const response = await createApp().request("/login");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("SPA");
    expect(body).not.toContain("EXPO-LOGIN");
  });

  it("sirve el APK desde public/descargas", async () => {
    const response = await createApp().request("/descargas/roomlink.apk");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("APK-BYTES");
  });

  it("no entrega index.html para rutas /api/ inexistentes", async () => {
    const response = await createApp().request("/api/v1/no-existe");
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.not.toContain("SPA");
  });
});
