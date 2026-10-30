// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { batchSchema, EVENT_SCHEMAS, isTrackablePath } from "./events";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("Tracking-Plan", () => {
  test("jedes Ereignis hat eine Version >= 1", () => {
    for (const s of Object.values(EVENT_SCHEMAS)) expect(s.version).toBeGreaterThanOrEqual(1);
  });

  test("Formularfehler nimmt keine Freitext-Werte an", () => {
    const schema = EVENT_SCHEMAS.form_field_error.props;
    expect(
      schema.safeParse({ form: "kursbuchung", field: "iban", code: "ungueltig" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ form: "kursbuchung", field: "iban", code: "DE89 3704 0044" }).success,
    ).toBe(false);
    expect(schema.safeParse({ form: "x", field: "iban", code: "ok", value: "DE89" }).success).toBe(
      false,
    );
  });

  test("Bereiche mit persönlichen Daten werden nicht gemessen", () => {
    expect(isTrackablePath("/admin")).toBe(false);
    expect(isTrackablePath("/admin/kurse")).toBe(false);
    expect(isTrackablePath("/portal/kinder")).toBe(false);
    expect(isTrackablePath("/kurse")).toBe(true);
    expect(isTrackablePath("/adminfoo")).toBe(true);
  });

  test("Batch: Größe und Struktur werden geprüft", () => {
    const ok = {
      consent_version: 1,
      visitor_id: uuid,
      session_id: uuid,
      events: [{ name: "page_view", v: 1, ts: Date.now(), path: "/kurse", props: {} }],
    };
    expect(batchSchema.safeParse(ok).success).toBe(true);
    expect(batchSchema.safeParse({ ...ok, events: [] }).success).toBe(false);
    expect(batchSchema.safeParse({ ...ok, visitor_id: "keine-uuid" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...ok, ip: "1.2.3.4" }).success).toBe(false);
  });
});
