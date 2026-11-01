// Bau-Konfiguration der Seite (TanStack Start + React + Tailwind), Ausgabe für Cloudflare Workers.
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // VITE_*-Einstellungen (z. B. die Supabase-Adresse) fest in den Code einsetzen,
  // auch für den Server-Teil.
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Eigener Server-Einstieg mit Fehlerbehandlung (src/server.ts).
        server: { entry: "server" },
        // Server-Code darf nie in den Browser-Teil geraten.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Das Cloudflare-Paket wird nur beim Bauen erzeugt, nicht im Entwicklungsbetrieb.
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      viteReact(),
    ],
  };
});
