// Server-only: Web-Push (VAPID + aes128gcm, RFC 8291/8292) ohne Node-Abhängigkeiten.
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function vapidKeys() {
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("VAPID_SEED fehlt");
  const d = sha256(enc.encode(`vapid:${seed}`));
  return { d, pub: p256.getPublicKey(d, false) };
}

export function vapidPublicKey(): string {
  return b64url(vapidKeys().pub);
}

function vapidAuth(endpoint: string) {
  const { d, pub } = vapidKeys();
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: "mailto:info@sicher-schwimmen.com",
      }),
    ),
  );
  const data = `${header}.${claims}`;
  const sig = p256.sign(sha256(enc.encode(data)), d, { prehash: false });
  return `vapid t=${data}.${b64url(sig)}, k=${b64url(pub)}`;
}

async function encrypt(payload: Uint8Array, p256dh: string, authSecret: string) {
  const uaPub = b64urlDecode(p256dh);
  const auth = b64urlDecode(authSecret);
  const asPriv = p256.utils.randomSecretKey();
  const asPub = p256.getPublicKey(asPriv, false);
  const ecdh = p256.getSharedSecret(asPriv, uaPub).slice(1, 33);
  const ikm = hkdf(sha256, ecdh, auth, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = hkdf(sha256, ikm, salt, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(sha256, ikm, salt, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      concat(payload, new Uint8Array([2])),
    ),
  );
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

export interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Sendet eine Push-Mitteilung. Liefert 'gone', wenn das Abo nicht mehr existiert. */
export async function sendPush(sub: PushSub, msg: PushMessage): Promise<"ok" | "gone" | "error"> {
  try {
    const body = await encrypt(enc.encode(JSON.stringify(msg)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth(sub.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) {
      console.error("push failed", res.status, await res.text().catch(() => ""));
      return "error";
    }
    return "ok";
  } catch (e) {
    console.error("push error", e);
    return "error";
  }
}

/** Push an alle aktivierten Geräte der bestätigten Teilnehmer eines Kurses. */
export async function sendPushToCourse(courseId: string, msg: PushMessage) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: parts } = await supabaseAdmin
    .from("course_participants")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "confirmed");
  const ids = (parts ?? []).map((p) => p.id);
  if (!ids.length) return { sent: 0, devices: 0 };
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .in("participant_id", ids);
  const byEndpoint = new Map<string, PushSub>();
  for (const s of subs ?? []) byEndpoint.set(s.endpoint, s);
  let sent = 0;
  for (const s of byEndpoint.values()) {
    const r = await sendPush(s, msg);
    if (r === "ok") sent++;
    if (r === "gone")
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  }
  return { sent, devices: byEndpoint.size };
}

export function newPushToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}
