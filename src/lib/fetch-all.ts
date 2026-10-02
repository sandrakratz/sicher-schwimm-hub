// Hilfen gegen zwei stille Grenzen der Datenbank-Schnittstelle (client- und serverseitig nutzbar):
//  1. Pro Abfrage kommen höchstens 1000 Zeilen zurück – alles darüber fehlt ohne Fehlermeldung.
//  2. `.in("spalte", [...viele IDs])` steckt die IDs in die URL; ab einigen hundert IDs wird sie zu lang.

const PAGE = 1000

type Page = PromiseLike<{ data: any[] | null; error: { message: string } | null }>

/**
 * Lädt alle Zeilen einer Abfrage seitenweise. `build` bekommt von/bis (Zeilenindex) und muss
 * `.range(from, to)` anwenden. Die Abfrage braucht eine eindeutige Sortierung (z. B. nach `id`),
 * sonst können Zeilen zwischen den Seiten doppelt oder gar nicht erscheinen.
 */
export async function fetchAll<T = any>(
  build: (from: number, to: number) => Page,
  /** Obergrenze (grob, seitenweise); schützt Listen, die sonst unbegrenzt wachsen. */
  maxRows = Infinity,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE || out.length >= maxRows) return out
  }
}

/**
 * Führt eine `.in()`-Abfrage in Blöcken aus (Standard 100 IDs, ca. 3,7 KB URL) und fasst die Ergebnisse
 * zusammen. Jeder Block wird bei Bedarf seitenweise geladen.
 */
export async function fetchIn<T = any>(
  ids: readonly string[],
  build: (chunk: string[], from: number, to: number) => Page,
  size = 100,
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const out: T[] = []
  for (let i = 0; i < unique.length; i += size) {
    const chunk = unique.slice(i, i + size)
    out.push(...(await fetchAll<T>((from, to) => build(chunk, from, to))))
  }
  return out
}
