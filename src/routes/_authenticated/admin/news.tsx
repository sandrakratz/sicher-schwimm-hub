import { createFileRoute } from "@tanstack/react-router";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { canNotify } from "@/lib/news-notice";
import {
  getNewsNoticeInfo,
  sendNewsNoticeBatch,
  sendNewsNoticeTest,
} from "@/lib/news-notice.functions";
import { MediaUploadField } from "@/components/admin/MediaUploadField";

export const Route = createFileRoute("/_authenticated/admin/news")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: Page,
});

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Öffentlich",
  members: "Mitglieder",
  trainers: "Trainer:innen",
  admin: "Admin",
};

type News = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  visibility: "public" | "members" | "trainers" | "admin";
  published: boolean;
  published_at: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_mime: string | null;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[m] || m)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Page() {
  const [rows, setRows] = useState<News[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<News>>({});
  const [notice, setNotice] = useState<null | {
    news: News;
    info: Awaited<ReturnType<typeof getNewsNoticeInfo>> | null;
    busy: boolean;
    progress: string;
  }>(null);

  async function openNotice(n: News) {
    setNotice({ news: n, info: null, busy: true, progress: "" });
    try {
      const info = await getNewsNoticeInfo({ data: { newsId: n.id } });
      setNotice({ news: n, info, busy: false, progress: "" });
    } catch (err) {
      setNotice(null);
      toast.error(err instanceof Error ? err.message : "Vorschau nicht möglich.");
    }
  }

  async function sendTest() {
    if (!notice) return;
    try {
      const r = await sendNewsNoticeTest({ data: { newsId: notice.news.id } });
      toast.success(`Testmail an ${r.to} gesendet.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Testmail fehlgeschlagen.");
    }
  }

  async function sendAll() {
    if (!notice?.info) return;
    const open = notice.info.open;
    if (
      !confirm(
        `Jetzt an ${open} Mitglieder-Adressen senden? Diese Mail kann nicht zurückgeholt werden.`,
      )
    )
      return;
    const newsId = notice.news.id;
    let delivered = 0;
    setNotice((p) => (p ? { ...p, busy: true, progress: "Wird gesendet…" } : p));
    try {
      for (let i = 0; i < 100; i++) {
        const r = await sendNewsNoticeBatch({ data: { newsId } });
        delivered += r.delivered;
        setNotice((p) =>
          p ? { ...p, progress: `${delivered} gesendet, noch ${r.remaining} offen…` } : p,
        );
        if (r.remaining === 0) break;
        if (r.limitReached) {
          toast.warning(
            `Das Tageslimit des Mail-Anbieters ist erreicht. ${delivered} gesendet, ${r.remaining} offen. Morgen auf „Weiter senden“ klicken.`,
          );
          break;
        }
        if (r.delivered === 0) {
          toast.warning(
            `Es konnte nichts mehr gesendet werden. ${r.remaining} Adressen sind offen (siehe Versandstatus).`,
          );
          break;
        }
      }
      toast.success(`${delivered} Mails gesendet.`);
      const info = await getNewsNoticeInfo({ data: { newsId } });
      setNotice((p) => (p ? { ...p, info, busy: false, progress: "" } : p));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Versand unterbrochen.");
      setNotice((p) => (p ? { ...p, busy: false, progress: "" } : p));
    }
  }

  async function load() {
    const { data } = await supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as News[]) || []);
  }
  useEffect(() => {
    load();
  }, []);

  /** Datei im Speicher löschen (Fehler sind nicht kritisch: die Datei bleibt dann nur liegen). */
  async function removeStored(path: string | null | undefined) {
    if (!path) return;
    const { error } = await supabase.storage.from("media").remove([path]);
    if (error) console.warn("Datei konnte nicht gelöscht werden:", path, error.message);
  }

  function startNew() {
    setEditing({ category: "general", visibility: "public", published: false, content: "" });
    setOpen(true);
  }
  function startEdit(n: News) {
    setEditing(n);
    setOpen(true);
  }

  async function save() {
    if (!editing.title) return toast.error("Titel erforderlich");
    if (!editing.content && !editing.image_url)
      return toast.error("Bitte Text eingeben oder Bild/PDF hochladen");
    const publish = !!editing.published;
    const payload: any = {
      title: editing.title,
      slug: editing.slug || slugify(editing.title),
      excerpt: editing.excerpt || null,
      content: editing.content || "",
      image_url: editing.image_url || null,
      image_alt: editing.image_alt || null,
      image_mime: editing.image_mime || null,
      category: editing.category || "general",
      visibility: editing.visibility || "public",
      published: publish,
      published_at: publish ? editing.published_at || new Date().toISOString() : null,
    };
    const res = editing.id
      ? await supabase.from("news").update(payload).eq("id", editing.id)
      : await supabase.from("news").insert(payload);
    if (res.error) return toast.error(res.error.message);
    // Ersetztes/entferntes Bild bzw. PDF aus dem Speicher löschen (sonst bleibt es dort liegen)
    const oldImage = editing.id ? rows.find((r) => r.id === editing.id)?.image_url : null;
    if (oldImage && oldImage !== (editing.image_url || null)) await removeStored(oldImage);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(n: News) {
    if (!confirm(`Beitrag "${n.title}" löschen?`)) return;
    const { error } = await supabase.from("news").delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    await removeStored(n.image_url);
    toast.success("Gelöscht");
    await load();
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">News-Verwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Beiträge erstellen, veröffentlichen und pflegen.
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="h-4 w-4" /> Neuer Beitrag
        </Button>
      </div>

      <CollapsibleCard
        title="Beiträge"
        storageKey="admin-news"
        contentClassName="px-0 overflow-x-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Sichtbarkeit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Veröffentlicht</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Noch keine Beiträge.
                </TableCell>
              </TableRow>
            )}
            {rows.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.title}</TableCell>
                <TableCell className="text-xs">{n.category}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {VISIBILITY_LABEL[n.visibility] || n.visibility}
                  </Badge>
                </TableCell>
                <TableCell>
                  {n.published ? (
                    <Badge className="bg-emerald-100 text-emerald-900">Veröffentlicht</Badge>
                  ) : (
                    <Badge variant="secondary">Entwurf</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {n.published_at ? formatDateBerlin(n.published_at) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {canNotify(n) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Alle Mitglieder per E-Mail auf diesen Beitrag hinweisen"
                      onClick={() => openNotice(n)}
                    >
                      <Mail className="h-4 w-4" /> Per Mail ankündigen
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => startEdit(n)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Beitrag löschen"
                    title="Beitrag löschen"
                    onClick={() => remove(n)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleCard>

      <Dialog open={!!notice} onOpenChange={(o) => !o && !notice?.busy && setNotice(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mitglieder per E-Mail informieren</DialogTitle>
          </DialogHeader>
          {!notice?.info ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/40">
                <div className="text-xs text-muted-foreground">So sieht der Inhalt aus:</div>
                <div className="font-semibold text-primary-deep mt-1">{notice.info.title}</div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{notice.info.preview}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  Knopf „Weiterlesen“ → {notice.info.url}
                </div>
              </div>
              <ul className="text-sm space-y-1">
                <li>
                  Empfänger insgesamt: <strong>{notice.info.total}</strong> (aktive Mitglieder, ohne
                  Doppelte)
                </li>
                <li>
                  Schon informiert: <strong>{notice.info.alreadySent}</strong> · noch offen:{" "}
                  <strong>{notice.info.open}</strong>
                </li>
                <li>
                  Heute noch möglich (Tageslimit des Mail-Anbieters):{" "}
                  <strong>{notice.info.budgetToday}</strong>
                </li>
              </ul>
              {notice.info.open > notice.info.budgetToday && (
                <p className="text-sm text-amber-700">
                  Das Tageslimit reicht nicht für alle. Es wird so viel gesendet wie möglich, den
                  Rest kannst du morgen mit „Weiter senden“ nachholen.
                </p>
              )}
              {notice.progress && <p className="text-sm font-medium">{notice.progress}</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={!notice?.info || notice.busy} onClick={sendTest}>
              Testmail an mich
            </Button>
            <Button
              disabled={!notice?.info || notice.busy || notice.info.open === 0}
              onClick={sendAll}
            >
              {notice?.busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {notice?.info && notice.info.alreadySent > 0 ? "Weiter senden" : "An alle senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Beitrag bearbeiten" : "Neuer Beitrag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Titel *</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      title: e.target.value,
                      slug: p.slug || slugify(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={editing.slug || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, slug: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Kurzbeschreibung</Label>
              <Textarea
                rows={2}
                value={editing.excerpt || ""}
                onChange={(e) => setEditing((p) => ({ ...p, excerpt: e.target.value }))}
              />
            </div>
            <div>
              <Label>Inhalt (optional, wenn ein Bild hochgeladen ist)</Label>
              <Textarea
                rows={10}
                value={editing.content || ""}
                onChange={(e) => setEditing((p) => ({ ...p, content: e.target.value }))}
              />
            </div>
            <MediaUploadField
              folder="news"
              value={editing.image_url}
              mime={editing.image_mime}
              alt={editing.image_alt}
              onChange={(v) => setEditing((p) => ({ ...p, ...v }))}
              onAltChange={(v) => setEditing((p) => ({ ...p, image_alt: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Input
                  value={editing.category || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value }))}
                  placeholder="general / event / kurs ..."
                />
              </div>
              <div>
                <Label>Sichtbarkeit</Label>
                <Select
                  value={editing.visibility}
                  onValueChange={(v: any) => setEditing((p) => ({ ...p, visibility: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Öffentlich</SelectItem>
                    <SelectItem value="members">Mitglieder</SelectItem>
                    <SelectItem value="trainers">Trainer:innen</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!editing.published}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, published: !!v }))}
              />{" "}
              Veröffentlichen
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
