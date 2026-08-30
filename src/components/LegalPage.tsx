import { PublicLayout } from "./PublicLayout";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <section className="bg-hero text-hero-foreground py-16">
        <div className="container mx-auto px-4">
          <h1
            lang="de"
            className="font-display text-3xl sm:text-4xl md:text-5xl font-bold break-words hyphens-auto"
          >
            {title}
          </h1>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 max-w-3xl prose prose-slate">
        <div className="space-y-4 text-foreground/85 leading-relaxed break-words">{children}</div>
      </section>
    </PublicLayout>
  );
}
