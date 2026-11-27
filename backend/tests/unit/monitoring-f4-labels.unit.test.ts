import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const catalogPath = join(root, "docs", "sli-catalog.md");
const testsDir = join(root, "backend", "tests");

async function testFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? testFiles(path) : [path];
    }),
  );
  return nested.flat().filter((path) => path.endsWith(".test.ts"));
}

async function allTestSource(): Promise<string> {
  const files = await testFiles(testsDir);
  const contents = await Promise.all(files.map((path) => readFile(path, "utf8")));
  return contents.join("\n");
}

describe("F4 · trazabilidad de pruebas con SLI", () => {
  it("liga los 15 SLI de reglas F3 con al menos una prueba etiquetada", async () => {
    const catalog = await readFile(catalogPath, "utf8");
    const ruleIds = [...catalog.matchAll(/\|\s*(\d{1,2}\.\d{1,2})\s*\|[^|]*\|\s*test\s*\|/g)].map(
      (match) => match[1]!,
    );

    expect(ruleIds).toEqual([
      "1.5", "2.6", "3.3", "4.2", "5.3", "6.3", "7.6", "8.3",
      "9.5", "10.5", "11.4", "12.4", "13.5", "14.4", "15.3",
    ]);

    const source = await allTestSource();
    for (const id of ruleIds) {
      const label = `\\[SLI\\s+${id.replace(".", "\\.")}\\]`;
      expect(source, `Falta una prueba etiquetada [SLI ${id}]`).toMatch(new RegExp(label));
    }
  });

  it("incluye las etiquetas de error y caída de base del plan", async () => {
    const source = await allTestSource();
    expect(source).toContain("[E-01]");
    expect(source).toContain("[E-03]");
    expect(source).toContain("[D-03]");
  });
});
