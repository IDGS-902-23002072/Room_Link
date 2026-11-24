import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Replica el alias "@/*" -> "./src/*" de Room_Link/tsconfig.json (Metro lo
// resuelve igual), para poder probar módulos que importan con "@/".
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./Room_Link/src", import.meta.url)),
    },
  },
});
