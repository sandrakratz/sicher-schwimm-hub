import { z } from "zod";

/**
 * Tracking-Plan: einzige Quelle der Wahrheit für alle Messereignisse.
 * Jedes Ereignis hat eine Schema-Version. Wird ein Ereignis inhaltlich geändert (Felder, Bedeutung),
 * wird die Version erhöht und die alte Definition bleibt für die Auswertung alter Daten stehen.
 * Es werden nie Formularinhalte erfasst, nur Feldnamen, Codes und Zähler.
 */

const short = (max = 60) => z.string().trim().min(1).max(max);
const code = z.string().regex(/^[a-z0-9_]{1,40}$/);

export const EVENT_SCHEMAS = {
  page_view: { version: 1, props: z.object({}).strict() },
  page_leave: {
    version: 1,
    props: z
      .object({
        visible_ms: z
          .number()
          .int()
          .min(0)
          .max(4 * 60 * 60 * 1000),
        max_scroll_pct: z.number().int().min(0).max(100),
      })
      .strict(),
  },
  cta_click: { version: 1, props: z.object({ cta: code }).strict() },
  form_start: { version: 1, props: z.object({ form: code }).strict() },
  form_field_error: {
    version: 1,
    props: z.object({ form: code, field: code, code: code }).strict(),
  },
  form_submit_attempt: {
    version: 1,
    props: z.object({ form: code, valid: z.boolean() }).strict(),
  },
  form_submit_error: { version: 1, props: z.object({ form: code, code: code }).strict() },
  form_submit_success: { version: 1, props: z.object({ form: code }).strict() },
  form_abandon: {
    version: 1,
    props: z.object({ form: code, last_field: code.optional() }).strict(),
  },
  experiment_exposure: { version: 1, props: z.object({}).strict() },
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;

/** Serverseitig gezählte Ereignisse (Gegenmessung, ohne Besucher-ID). */
export const SERVER_EVENT_SCHEMAS = {
  form_received: { version: 1, props: z.object({ form: code }).strict() },
  form_rejected: { version: 1, props: z.object({ form: code, reason: code }).strict() },
} as const;

export type ServerEventName = keyof typeof SERVER_EVENT_SCHEMAS;

export const experimentRefSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]{2,60}$/),
    version: z.number().int().min(1).max(999),
    variant: short(40),
  })
  .strict();

export const batchSchema = z
  .object({
    consent_version: z.number().int().min(1),
    visitor_id: z.string().uuid(),
    session_id: z.string().uuid(),
    app_build: short(40).optional(),
    device_class: z.enum(["mobile", "tablet", "desktop"]).optional(),
    referrer_host: short(120).optional(),
    events: z
      .array(
        z
          .object({
            name: short(60),
            v: z.number().int().min(1),
            ts: z.number().int(),
            path: short(200),
            props: z.record(z.unknown()).default({}),
            exp: experimentRefSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(25),
  })
  .strict();

export type EventBatch = z.infer<typeof batchSchema>;

/** Bereiche, die nie gemessen werden (Anmeldung, Verwaltung, persönliche Bereiche). */
export const UNTRACKED_PATH_PREFIXES = [
  "/admin",
  "/portal",
  "/trainer",
  "/auth",
  "/anmelden",
  "/login",
  "/volljaehrigkeit",
  "/unsubscribe",
  "/email",
  "/api",
];

export function isTrackablePath(path: string): boolean {
  return !UNTRACKED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
