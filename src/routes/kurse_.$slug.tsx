import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { AdultCoursePage } from "@/components/AdultCoursePage";
import { BookableProgramPage } from "@/components/public/BookableProgramPage";
import { UpcomingProgramPage } from "@/components/public/UpcomingProgramPage";
import { ADULT_COURSE_SLUG } from "@/lib/adult-course";
import { getCourseProgram, type CourseProgram } from "@/lib/courses-public.functions";

function CourseNotFound() {
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-4">
          Kurs nicht gefunden
        </h1>
        <Button asChild>
          <Link to="/kurse">Zur Kursübersicht</Link>
        </Button>
      </section>
    </PublicLayout>
  );
}

export const Route = createFileRoute("/kurse_/$slug")({
  loader: async ({ params }) => {
    const program = await getCourseProgram({ data: { slug: params.slug } });
    // Alte Adresse des Schwimmstarters (Links aus früheren E-Mails)
    if (!program && params.slug === "s")
      throw redirect({ to: "/kurse/$slug", params: { slug: "schwimmstarter" } });
    if (!program) throw notFound();
    return program;
  },
  head: ({ params, loaderData }) => {
    const p = loaderData as CourseProgram | undefined;
    const up = p && p.bookable === false ? p : undefined;
    const title = up
      ? `${up.name} – geplantes Angebot | Sicher Schwimmen e.V.`
      : p
        ? `${p.name} – Schwimmkurs buchen | Sicher Schwimmen e.V.`
        : "Schwimmkurs | Sicher Schwimmen e.V.";
    const desc = up
      ? `${(up.description ?? "").split(/\n/)[0]} Geplantes Angebot – derzeit noch nicht buchbar.`
      : p?.description
        ? `${p.description} Freie Termine online verbindlich buchen.`
        : "Schwimmkurs mit freien Terminen online verbindlich buchen.";
    const url = `https://sicher-schwimmen.com/kurse/${encodeURIComponent(params.slug)}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },

  component: ProgramPage,
  errorComponent: CourseNotFound,
  notFoundComponent: CourseNotFound,
});

function ProgramPage() {
  const data = Route.useLoaderData() as CourseProgram;
  // Erwachsenenschwimmen: eigene Seite mit Interessenformular, solange nicht buchbar
  if (data.bookable === false && data.slug === ADULT_COURSE_SLUG)
    return <AdultCoursePage program={data} />;
  if (data.bookable === false) return <UpcomingProgramPage up={data} />;
  return <BookableProgramPage program={data} />;
}
