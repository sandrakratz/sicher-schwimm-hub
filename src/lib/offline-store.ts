// Offline-Speicher für den Trainerbereich (IndexedDB, nur im Browser).
// Enthält bewusst nur das, was am Beckenrand gebraucht wird: Einsätze der nächsten Tage mit Namen und Hinweisen
// der Teilnehmenden. Nach 48 Stunden und beim Abmelden wird alles gelöscht. Kontaktdaten und Geburtsdaten
// werden nicht gespeichert.

export type OfflineParticipant = { id: string; name: string; hint: string | null };

export type OfflineSession = {
  id: string;
  courseId: string;
  courseName: string;
  location: string | null;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  index: number;
  team: string[];
  participants: OfflineParticipant[];
};

export type OfflineSnapshot = { userId: string; generatedAt: string; sessions: OfflineSession[] };

export type AttendanceMark = "present" | "excused" | "absent" | null;
export type QueuedMark = {
  key: string; // sessionId|participantId – die letzte Eingabe gilt
  sessionId: string;
  participantId: string;
  status: AttendanceMark;
  at: number;
};

const DB_NAME = "sicher-schwimmen-offline";
const FLAG = "offline-enabled";
export const MAX_AGE_MS = 48 * 3600 * 1000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("queue", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  store: "kv" | "queue",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const isOfflineEnabled = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};
export const setOfflineEnabled = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* ohne Speicher kein Offline-Modus */
  }
};

export async function saveSnapshot(s: OfflineSnapshot) {
  await run("kv", "readwrite", (st) => st.put(s, "snapshot"));
}

/** Liefert den Stand nur, wenn er jünger als 48 Stunden ist; ältere Daten werden gelöscht. */
export async function loadSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    const s = await run<OfflineSnapshot | undefined>("kv", "readonly", (st) => st.get("snapshot"));
    if (!s) return null;
    if (Date.now() - Date.parse(s.generatedAt) > MAX_AGE_MS) {
      await run("kv", "readwrite", (st) => st.delete("snapshot"));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function enqueueMark(m: Omit<QueuedMark, "key" | "at">) {
  await run("queue", "readwrite", (st) =>
    st.put({ ...m, key: `${m.sessionId}|${m.participantId}`, at: Date.now() }),
  );
}
export async function listQueue(): Promise<QueuedMark[]> {
  try {
    return await run<QueuedMark[]>("queue", "readonly", (st) => st.getAll());
  } catch {
    return [];
  }
}
export async function removeFromQueue(key: string) {
  await run("queue", "readwrite", (st) => st.delete(key));
}

/** Alles löschen (Abmelden, Offline-Modus ausschalten). Noch nicht übertragene Eingaben gehen dabei verloren. */
export async function clearOfflineData() {
  setOfflineEnabled(false);
  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    if ("caches" in window) {
      for (const k of await caches.keys()) if (k.startsWith("shell-")) await caches.delete(k);
    }
  } catch {
    /* ignorieren */
  }
}
