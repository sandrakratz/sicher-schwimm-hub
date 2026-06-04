import { PublicLayout } from "./PublicLayout";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-4xl md:text-5xl font-bold">{title}</h1>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 max-w-3xl prose prose-slate">
        <div className="space-y-4 text-foreground/85 leading-relaxed">{children}</div>
      </section>
    </PublicLayout>
  );
}
