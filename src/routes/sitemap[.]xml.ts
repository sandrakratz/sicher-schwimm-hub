import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://sicher-schwimmen.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/kurse", changefreq: "weekly", priority: "0.9" },
          { path: "/kurs-anfragen", changefreq: "monthly", priority: "0.9" },
          { path: "/mitgliedschaft", changefreq: "monthly", priority: "0.9" },
          { path: "/ueber-uns", changefreq: "monthly", priority: "0.7" },
          { path: "/sicherheit", changefreq: "monthly", priority: "0.7" },
          { path: "/kontakt", changefreq: "monthly", priority: "0.7" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/news", changefreq: "weekly", priority: "0.6" },
          { path: "/kursbedingungen", changefreq: "yearly", priority: "0.3" },
          { path: "/satzung", changefreq: "yearly", priority: "0.3" },
          { path: "/mitgliedsordnung", changefreq: "yearly", priority: "0.3" },
          { path: "/datenschutz", changefreq: "yearly", priority: "0.3" },
          { path: "/impressum", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
